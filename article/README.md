Dealing with memory leaks in JavaScript applications can be a complex process. In this article I'm going to show you how to identify whether you have memory leaks, analyse them and ultimately resolve them.

In this article I'm using an AngularJS application to demonstrate the concepts and approaches, but the majority of this material is not related to AngularJS and applies to any JavaScript application.

1. What are Memory Leaks?
2. Identifying Memory Leaks
3. Analysing Memory Leaks
4. Dealing with Object Graphs
5. Anti-Patterns to avoid
6. Mysteries

## What are Memory Leaks?

Let's take a look at what a memory leak is first, so we know what we're dealing with.

> TODO: When we allocate memory and don't release it when we are done, we have 'leaked' that memory.

Basically. This is really easy to do in languages where you manage memory yourself:

```c
// in C
data = malloc(todo);

// in C+++
data = new int[30];
```

TODO Here I allocated `count` integers and didn't free the memory. Every time this function runs, I allocate memory and never free it, it's leaked.

So how do we get memory leaks in JavaScript applications, when we don't allocate memory?

Well strictly, we don't. Every object we create has as reference count, when we use that object, the reference count is incremented, when we are done with it, the reference count is decremented and when the count hits zero the memory it uses can be released. This is all handled for us in JavaScript (and many other languages). So strictly we don't leak memory, the JavaScript engine correctly understands we still have references to objects and therefore doesn't free them. We produce memory leak like behaviour (say that fast ten times) by keeping references to objects longer than we should. If this doesn't make sense, it should by the end of the article, as we'll engineer some.

I'll keep on using the term 'memory leak' in this article.

### Why is a Memory Leak bad?

It might seem obvious but let's just make sure we're explicit with everything. As we a said in the initial definition, we allocate memory but don't deallocate it.

In **some** circumstances, this is not necessarily a problem, if we don't leak too much too often, but there are circumstances where this is very serious.

The sorts of problems we'll get with memorys leaks are a drop in performance, but more seriously after a while a process will simply terminate - as it tries to allocate memory and fails. Before we get to this point we'll often see extremely poor performance if the process ends up using Virtual Memory.

#### Servers

You *really* don't want to leak memory in a server application. Servers are often expected to run for long periods of time and serve many requests, if servers leak memory they will die, often quickly. In many cases servers will recover, for example if an IIS worker process dies due to a leak, IIS will recreate it, similarly for COM+ services and many other platforms. But this is still a serious problem - recreating the process can be expensive, and if you want high throughput this will be a killer.

#### Embedded Applications

If you've ever done development for embedded systems, you'll know that leaks here are serious. That's because they often have a lot less memory available. Many embedded systems will also be expected to run for long periods of time or process a high volume of data. I've worked with embedded systems that collect data from different components of a complicated machine and send it to a centralised server - issues on these systems lead to difficult to fix problems.

#### 'Important' Applications

Anything you use for a while that's important to you. It sounds dumb, but if you are using a certain tool for a long time every day and restarting it is hard or time consuming, that's a problem. If a calculator application you use once a week for two minutes leaks, it's probably not going to cause too many problems.

#### Single Page Apps

This is the sort of app we'll focus on. Single page apps are notoriously leaky because the browser doesn't get the opportunities to clean up memory allocated by Javascript. 'Normal' applications free most of the memory used by the Javascript environment every time we move to a new page, but modern single page apps will not get that opportunity.

## Identifying Memory Leaks

Let's get started. I've created a sample app for showing photo albums which is leaky in parts. We'll look at different ways of analysing leaks and the pros and cons of each one. The app is at:

[TODO](http://todo)

There's a menu on the top right that lets you run an automated set of steps, these are scenarios (some leaky, some not) we can quickly test.

#### The Wrong Way

First, just be aware that the wrong way to look for leaks is by examing the memory usage of the Chrome process. While an increasing amount of memory usage *can* indicate a leak, it is not reliable. Why?

Well browsers can allocate memory and use it how they want to. A page it is rendering may no longer need as much memory as it needed before, but that doesn't mean the browser needs to release it to the OS. It may just keep it to avoid having to re-allocate it later on.

#### Method 1: Memory Usage Graph

Open the Chrome developer tools. Go to 'Timeline' select 'Memory' and hit 'Record'.

{<1>}![Start Recording](/content/images/2015/02/StartRecording.png)

Now start using your application. After you are done, stop recording. You'll see a graph of memory usage.

{<2>}![Memory Usage](/content/images/2015/02/MemoryUsage.png)

This is **almost** exactly what we need. I'll explain the almost shortly, but lets take a look at this graph.

1. We see a *Used JS Heap* in blue. *Used* is important here - Chrome is telling us that there may be more heap usage than show in its actual process, but what we are seeing here is what is actually used by the page.
2. We see documents (in this case a steady value of one document).
3. We see DOM nodes. As I use the app the nodes increase, up until a certain point and then they drop.
4. We see Listeners (i.e. even handlers). Again, these increase as I use the app and then drop.

So what should we be looking for in this graph? That depends on what our app is doing. But let's imagine the we are navigating through different photo albums in the albums app. We'll need more memory to see each album, but once we leave an album we don't need that memory any more. So we should get a healthy saw-tooth pattern:

{<3>}![TODO]()

Here we see that we use more and more memory, up until the point that Chrome garbage collects, then go back to where we started. This is repeated again and again. This is a good sign - when Chrome garbage collects we go back to the same place we started, a strong indication we are not leaking much memory.

If we are doing some work which simply needs more and more memory, and we don't release it, we would expect to see steps instead:

{<4>}![TODO]()

An example of this might be an infinite scroll situation. I'm looking through a vast photo album, and when I get to the bottom of the screen I load more images automatically. The ones I've loaded are still in the DOM so cannot be released. We see no saw-tooth because there's no release of memory. However, this is not a memory leak - it's just increasing memory usage. It does mean that if we allow the user to scroll too much we may run out of resources though.

The **dangerous** case is the one below:

{<5>}![TODO]()

Let's imaging we're using the application, navigating through albums, returning the the home page, looking through some more albums and so on. We keep using memory, and Chrome keeps on garbage collecting, but we never quite get back to where we started. We are trending towards increasing memory usage. This indicates we *might* be leaking memory.

*Might* is not going to cut the mustard, we need to know categorically what is going on and whether we have a leak (which could eventually crash the browser with the user doing 'normal usage'). If we have Case 2, where there is an activity requiring unbounded DOM or complexity, that's a design issue, not a leak issue.

> You said this is 'almost' exactly what we need?

Unfortunately, you cannot always trust this graph. See Mystery 1 for the ugly details. Suffice to say that what we're seeing here is an indicator only, but for more detail we need to look at Method 2.

#### Method 2: Recording Heap Allocations

Let's look at a different way seeing if we've got a leak, the 'Heap Allocations' view. In the developer tools, go to 'Profiles' and 'Record Heap Allocations':

{<6>}![Record Heap Allocations](/content/images/2015/02/HeapAllocations.png)

When we record heap allocations we get a chart showing us spikes as we allocate memory. These spikes are initially blue (meaning Chrome is using the memory), then change to grey once the memory is freed. If we see spikes or sections of spikes that remain blue, we may have a problem.

Try this, go to the Ablums app and start recording. Click on the 'India' album, then go back to the home page. You should see a chart like this:

{<7>}![Heap Allocations Example 1](/content/images/2015/03/HeapAllocationsEx1.png)

So we start recording and nothing is being allocated. Then we click on the 'India' album (point 1) and we get a few spikes, as chrome allocates memory needed for the content in the new page. Then we click back on the home page (point 2). Some of the memory used in the India album is released (it looks like about half). One spike of memory used for the home page is still in use (what we'd expect) and another spike or two seem to be freed. These other spikes might be memory used for the actual transition, for example in logic in the router.

So this looks like we may have a problem in the album page. In fact, we can drag a selection box around those first three spikes and see what is *still* in memory (i.e. what might be a potential leak) in the view below:

{<8>}![Heap Allocations Example 2](/content/images/2015/03/HeapAllocationsEx2.png)

Dissecting this view we have:

1. A subset of the data, the blue spike from the album page which is still in use.
2. The 'Heap View', which shows us different *types* of data in memory. Don't worry, we'll see a lot more on this later.
3. An instance of a specific type of data, in this case an instance of a JavaScript object.
4. The retainers graph for the specific object.

We're going to look into what all of this means in a lot of detail as we go through the article. For now, I'll simply state what we're seeing, by the end of the article you'll be able to analyse this (and much more) yourself.

In this snapshot we see a small amount of data still in use. A quick look through the data reveils we have data still in use which relats to the AngularJS template cache.

This is good! It means this is probably not a leak. When I first visit the album page AngularJS is caching the template used to render it, so of course it stays in memory.

> When analysing memory usage remember that caching, preloading and other optimisation techniques may cause some noise.

So if we have the albums page in a cache, in theory the next time we visit the page and then return to the home page, we should free a lot more of the memory (because the *new* memory we allocate will be just for the page itself, not the cache which is already set up). Let's try it. We'll record going to the album page, back to the homepage, then the album page and back again:

{<9>}![Heap Allocations Example 3](/content/images/2015/03/HeapAllocationsEx3.png)

This is looking good.

1. We go to the 'India' album. Some memory used is now freed, but much is still in use. As we saw, at least some of that is the template cache.
2. We go back to the home page, lots of memory is used but by the time we're done recording it's almost entirely freed.
3. We visit the India album a second time, requiring some memory almost all of which is freed.
4. We go back to the home page. Some memory is used during the transition and to render the page, some of that is still in use (which is expected as the page is still open).

The heap allocations chart is exceptionally useful in identifying memory leaks. The memory usage charts paint a broad picture, but it's this chart which has already led to insights:

1. Initial loading of pages increases our 'baseline' memory footprint due to data being added to caches (such as the AngularJS template cache).
2. Subsequent loading of pages requires memory, but the vast majority of it is freed.

One thing we noticed from this brief analyse was that the initial result was slightly misleading (at first). With the heap allocations view repeated operations can help you identify trends. In the Albums applications I've actually set up part of the app to run repeated operations, so we can try to consistently test scenarions. The 'scenarios' menu lets us run them. Let's try running scenario 1.

{<10>}![Scenario 1](/content/images/2015/03/Scenario1.png)

This scenario will navigate from `/` (the home page) to `/nowhere` ten times. `/nowhere` isn't matched by the router so takes us back to the home page. This has the effect of reloading the home page 20 times (just reloading doesn't work, the router is smart enough to realise we're staying on the same page).

{<11>}![Scenario 1 Heap Allocations](/content/images/2015/03/Scneario1HeapAllocations.png)

While you are recording the chart you can see peaks go from blue to grey as memory is freed. Let's see what we've got.

1. Shows our first navigation, some memory is not freed. Everything before this is setup code.
2. Our last navigation. Some memory still in use (as expected).
3. A glance at memory in use shows some compiled code and system data (more on this later). At this stage we don't need to worry, Chrome will allocate data like this when it needs to.
4. It looks like the 11th page load didn't free all of it's memory. This is potential cause for worry.

Altogether this a very healthy looking scenario. The huge majority of what we allocate is freed, as we would hope. Small amounts of memory stay in use (mostly used under the hood by Chrome) and a small amount of memory after the 11th reload is not freed (a quick look suggests a timing issue, definitely something we'd want to investigate further in a real-world app). Our allocations are in the 50 KB to 100 KB range and we're looking good.

Before we say goodbye to the Heap Allocations view (for now) let's do the same for Scenario 2 (moving from the home page to the top rated page 10 times).

{<12>}![TODO](/content/images/2015/03/Scenario2HeapAllocations.png)

We are not going to analyse this issue (yet!) but this is an example of a much less healthy chart. In this chart we seem to be allocating memory for each page view and not releasing it. This kind of chart definitely indicates that there could be problems.

So we've seen the Heap Allocations view, which is a bit more sophisticated than the memory usage graph. Let's look at the last way to analyse memory leaks - snapshots.

#### Method 3: Heap Snapshots

The final method of identifying memory leaks is the most controlled. We will take snapshots at specific points in time and analyse the differences between them. To take a snapshot, we go to the Profiles view and choose 'Take Heap Snapshot':

{<13>}![Take Heap Snapshot](/content/images/2015/03/TakeHeapSnapshot.png)

When we take a heap snapshot Chrome simply records the details of all memory allocated.

> Remember: Taking a Snapshot **always** runs garbage collection first.

A heap snapshot shows you exactly the same kind of data you get in the Heap Allocations view, except that you are seeing ALL memory int use, not just objects which were allocated and are still alive:

{<14>}![A Heap Snapshot](/content/images/2015/03/HeapSnapshot1.png)

This view is very complete but not necessarily very useful. There's some extra ways to see the data (if you change from 'Summary' to another view or change 'All Objects' but we'll see that later).

Staying on topic, we'll not yet look in detail at what the data is that we are seeing, we'll first look into identifying whether there are memory leaks - then we'll look into tracking them down.

Indivdiual snapshots are not so helpful for checking for leaks, but what is very helpful is the ability to compare memory used between snapshots.

Let's take some snapshots, try this:

1. Open the app.
2. Navigate to the top rated page (caches should now be set up).
3. Navigate to the home page. Take a snapshot.
4. Navigate to the top rated page. Take a snapshot.
5. Navigate to the home page. Take a snapshot.

Now we can do something really cool. Select snapshot 3, and choose to view data allocated between snapshot 1 and 2. This means we're seeing data allocated for the top rated page, which is *still* in use when we go back to the home page, i.e. probably leaked.

{<15>}![Snapshot Comparison](/content/images/2015/03/SnapshotComparison.png)

So what are we seeing now?

1. We have three snapshots. The size of each one is shown. *Sometimes* the very first one seems overly high. See Mystery 2. We have selected the 3rd snapshot and are therefore only able to see data still present in this snapshot.
2. We are chosing to show only objects allocated between Snapshot 1 and 2, i.e. objects allocated to present the page. But we're **in** snapshot 3, so we're seeing those objects which were allocated and are still present.
3. Objects allocated are looking suspicious - we've got DOM elements. This doesn't look good!

This is the best way to identify memory leaks. So now that we've seen how to identify whether we have memory leaks, or at least that we have a potential problem to analyse we can move onto step 2 - Analysing Memory Leaks.

## Analysing Memory Leaks

If we think we have a memory leak, we need to be able to look at the heap data and see what's going on. Whether we are seeing heap data from a selection of allocations from the Heap Allocations view or from the Heap Snapshots, we see the same kind of information:

{<16>}![Heap Data](/content/images/2015/03/HeapData.png)

Column-by-column, we have:

**Constructor**

This is the type of object we have. Some of these objects we can see are JavaScript classes (constructed with a `new` call to a function), such as `Scope`. As well as our own classes, we have some special classes of data:

* (compiled code): Represents JavaScript code compiled by Chrome. Consider this internal - we have no control over it.
* (array): Internally used array object. Again, internal.
* Array: A JavaScript array. Often we have a *lot* of data in arrays.
* Object: A plain old JavaScript object.
* (closure): A closure.
* system / Context: The underlying data require to call a function, for example the actual data used by a closure.
* system: Internally used data.

There are also plenty of objects that are created by Chrome, such as `HTMLDivElement`, which is a wrapper around the internally used DOM object.

Let's dissect some of these objects in detail. Running scenario 3 allocates some data and puts it on the `window` object. This is really trivial data but shows a lot. You can use the Heap Allocations or Heap Snapshots to see the data. I've taken three snapshots (once when before pressing OK, once after the data is allocated, and the final one when the last modal is closed):

{<17>}![Heap Data Analysis Part 1](/content/images/2015/03/HeapDataAnalysis2.png)

This data has come from the code below:

```javascript
//  Create a class which will hold heap data. Makes it easier 
//  to find the data in Chrome.
function HeapData() {}

//  Create a heap data object.
var heapData = new HeapData();

//  Create a function that multiplies two numbers.
function multiply(a, b) {
  return a * b;
}

//  Create a 'multiply by' function, which curries the above
//  to generate a function which multiplies by a constant. This
//  will involve closures. 
var multiplyBy = function(a) {
  return function(b) {
    return multiply(a, b); 
  }
};

//  Add some data to our heap data object.
heapData.fry = "Philip J. Fry";
heapData.zoidberb = "John " + "Zoidberg";
heapData.character = {
  firstName: "Amy",
  secondName: "Wong"
};
heapData.double = multiplyBy(2);
heapData.multiplyBy100 = multiplyBy(100);
heapData.doubledNumber = heapData.double(18);
heapData.multipliedNumber = heapData.multiplyBy100(15);
heapData.div = document.createElement("div");

//  Put the heap data on the window, it is now pinned to a GC root.
window.heapData = heapData;
```

We've got a little bit of everything here, some code, some closures, some objects and a DOM element.

As we've put most of this data on the `heapData` object, which is an instance of `HeapData` we can easily find the object:

{<18>}![Heap Data Analysis 3](/content/images/2015/03/HeapDataAnalysis3.png)

So we can see the `HeapData` constructor, expanding it we see an *instance* of `HeapData`. The `@420269` is a unique ID assigned by Chrome. If we have lots of heap data objects, we can use this to distinguish between them when we're looking at other parts of the snapshot. What else do we see?

1. **Distance**. How far the instance is from a GC Root. A GC root is anything that can 'pin' objects, for example the `window` object which holds globals. If put something on `window` it will never be freed, this is what makes it a GC root. Our distance is 2 as we have `HeapData` (constructor) to `heapData` (instance) to `window`.
2. **Objects count**. Only valid for the top level nodes, this shows us how many objects of the specified type we have. We have 1 `HeapData` object.
3. **Shallow Size**. The size of the data that is directly allocated for the object. Compare this to *Retained Size*.
4. **Retained Size**. The size of data this object is retaining. For example, out `heapData` instance holds a reference to an object which contains two fields `firstName` and `secondName`. Our shallow size includes enough data for the refernce, the retained size includes the full retained size of the retained object.

Notice that our instance of `HeapData` is highlighted in yellow? That's a convenience from Chrome, it's showing us objects which are directly accessible from JavaScript. Our object can be accessed via `window.heapData`, therefore it's directly accessible. Other objects we've created might not be.

Let's see some other data we allocated:

{<19>}![Heap Data Analysis 4](/content/images/2015/03/HeapDataAnalysis4-1.png)

Now we're looking at closures. We have two closures in yellow next to each other, clicking on one shows the retainer graph. What is going on here?

1. Our closure is not a simple thing. It has code (of course), which takes up memory. We won't look into this in detail. It has shared function data (again, internally used and not worth looking into). We also have a reference to a `__proto__` (a function object has a prototype!). Finally, we have the context, which contains enough data to call the object. If we look in to the context we will not see much, as our function contains numbers which Chrome can simply store in the code. However, if we use references in closures we'll actually see them in the context.
2. We also have the retainers. Our closure is referenced via a variable called `multiplyBy100`, which itself is referenced by `heapData`, which if referenced by the `window` GC root.
3. The `multiplyBy100` varialbe is *also* dominated by the second element of an array with id `@227339`.

The last thing we'll look at in this snapshot is the div element.

{<20>}![Heap Data Analyis 5](/content/images/2015/03/HeapDataAnalysis5.png)

We can see the div element is retained by the `div` variable in the `heapData` object. We can also see it is made up of a prototype and some native object. The native object shows no size - don't be fooled. That just means its taking up no JavaScript heap memory. It is still using memory (just in V8 engine not the JavaScript code).

What's important to note here is that the element is shown in red. This means it's detached. So it exists, is referenced and cannot be garbage collected but is not in the DOM. This is not necessarily a problem, but lots of detached DOM elements is often a bad sign, especially if the number is increasing.

The rest of the data you can look through yourself. You'll notice some interesting things, such as how concatenated strings work, but the important stuff we've now seen.

Let's move on to analyising the first potential memory leak we discovered - the transition to the Top Rated page of the albums app.

#### Analysing the leak in Scenario 2

We saw that scenario 2, switching to and from the 'top rated' view seemed to leak memory. Let's use the heap snapshot comparison view to analyse this further. The steps are:

1. Navigate to the home.
2. Navigate to the top rated page (setting up the cache).
3. Navigate to the home page, take a snapshot.
4. Navigate to the top rated page, take a snapshot.
5. Navigate to the home page, take a snapshot.

We can now look at the memory allocated between 1 and 2 that is present in 3:

{<22>}![Scenario 2 Snapshot 1](/content/images/2015/03/Scenario2Snapshot1.png)

Some things jump out immediately:

1. We have gone from 7.5 to 8.4 to 8.5 MB. We are changing from one view to another - and ending in the same place that we started. We **should** be going back to 7.5 MB.
2. We've got a lot of objects still hanging around, not just system data like compiled code, but HTML elements, detached DOM elements, `Promise` objects, `n.fn.init` objects and so on.

This looks like a classic leak situation. Let's start by finding the object with the largest retained size which we can make some sense of, there are some `Scope` objects near the top of the chart, let's look at those.

{<24>}![Scenario 2 Part 2](/content/images/2015/03/Scenario1Part2.png)

We've got some `Scope` objects, three in fact. These objects contain the usual AngularJS fields such as `$parent`, the only field which distinguishes this scope is the `album` field. If we look at out `aml-rated-album` directive it looks like it could be the isolated scope for this directive:

```javascript
.directive('amlRatedAlbum', function() {
  return {
    restrict: "E",
    scope: {
      album: "="
    } // etc
```

This scope has an `album` field. There are three albums so it looks likely these are the three albums in the top rated page, the scopes stil in memory. What retains them?

Looking at the retainers (at **2**) we don't see much. We're retained by a `$$ChildScope`, which also retained by a `$$ChildScope` object. In fact we have quite a complex graph of objects.

> When we leak a scope in AngularJS, we leak a huge graph of objects.

Scopes know about their parents. They also know about their children, and siblings. If we inadvertantly pin a scope to a GC root, we **will probably leak almost all of the scopes in the page**.

Why? The graph below should show why. I 'leak' a scope, and by doing so I retain all of the other scopes, because they are connecting. Having a connected graph of scopes is required for angular to work, but it means that we we are extremely susceptible to leaking a **lot** of data.

{<27>}![TODO scope leak graph]()

So just grabbing a specific scope is not good enough. We need to try and be a little bit more specific. Let's try starting from an element instead. Here we take a look at a div element and its retainers:

{<29>}![Scenario 2 Part 3](/content/images/2015/03/Scenario2Part3.png)

Resting the mouse over the instance of a leaked `HTMLElement` shows a bit of data about it, it's a `aml-rated-album` and it is detached. Definitely a symptom of our leak. Let's see the retainers:

{<31>}![Scenario 2 Part 4](/content/images/2015/03/Scenario2Part4-1.png)

Ouch. This is nasty. Again, we are not seeing much that is particularly useful. We have a long graph of retainers starting with the `compileNode` function, we also have an array in a `n.fn.init` function. To cut a long story short, we're are not going to easily find the root cause here. But I will share some hints.

> jQuery isn't leaking.

We will end up seeing so much jQuery stuff it is natural to wonder whether jQuery is leaking. Almost certainly not. In the graph about `n.fn.init` is just a jQuery selector, held onto by `$$element`. No surprise - all angular elements are jQuery or jQuery light objects. We've leaked an element, it just happens to be wrapped in a jQuery selector. (You might see a different type of graph, probably due to the jQuery 1 + AngularJS 1.2 combination, we'll see it later).

You may see low level arrays containing data associated with a scope in jQuery, again, don't worry. It's the jQuery data cache (which we'll also see later), which is associating elements to scopes.

We can try and work through this graph, but let's try another tack.

It looks like we're probably leaking the whole of the top rated view. We're probably leaking the main scope for the view, created by the `TopRatedController`. Let's see if we can find it.

> You can find objects you think are leaking by tagging them with classes!

This is a neat trick. Let's add a couple of lines to our controller:

```javascript
angular.module('app')
.controller('TopRatedController', function($scope, $http, $interval) {

  //  Create a class, assign it to the scope. This'll help us 
  //  see if $scope is leaked.
  function TopRatedControllerTag() {}
  $scope.__tag = new TopRatedControllerTag();
  
  //  etc...
});
```

Now when we run the analysis again, we can search in the snapshot for `TopRatedControllerTag`:

{<33>}![Scenario 2 Part 5](/content/images/2015/03/Scenario2Part5.png)

1. We search for 'Tag', finding one instance of the `TopRatedControllerTag`.
2. Bingo - it is retained by a Scope, with id `@534851`

Let's look at this scope in more detail. Right click on it and choose 'Review in Summary View', so we can see what is retaining it:

{<35>}![Scenario 2 Part 6](/content/images/2015/03/Scenario2Part6.png)

1. We can now see the root scope for the actual view.
2. We can see the usual pattern of `$$ChildScope` and `$parent` properties, but what else have we got?

Intestinglt we can see that our scope is also retained by a **context variale called $scope**. This is interesting. How do I know it is a context varible? It's in blue, part of the colour coding (see Mystery 3). 

What is a context variable?

> A **closure** is a function which refers to a variable outside of its definition. A **context variable** is the variable stored in a function context. A **function context** contains the environment for a closure, which is the data required to execute it.

So basically we have a closure which refers to a variable called `$scope`, which is the root scope of our view. We can see in detail the closure:

{<36>}![Scenario 2 Part 7](/content/images/2015/03/Scenario2Part7.png)

1. `$scope` is retained by a `context` for a closure.
2. The closure is in the `refresh` function (this is why the `context` is retained by `refresh`).

We can open the function and examine it for issues. There's an `$http.get` which has as closure which uses `$scope`, but alarmingly there is an `$interval` registered to run every 10 seconds, which is never deregistered. The interval callback uses another `$http.get`, with a closure that uses `$scope`. This is the problem.

A simple timeout we forgot to deregister has a closure on `$scope`. `$scope` can therefore never be cleaned up, because it is retained by a context.

Some important takeaways:

1. The framework hids implementation details. Often useful, but in this case it made finding the leak a problem.
2. This example seems contrived, but how how often do you have a closure using `$scope` in a controller? In real world apps all of the time time, callbacks to ajax requests, event handlers, promise functions etc.
3. A leak of a small object that contains the **data** for three albums has leaked a **large graph** of other objects, and even **DOM elements**.

> Leaks are not incremental. You don't get an accumulation of small leaks, one small leak can retain a huge graph.

Let's talk about this a bit more.

## Dealing with Object Graphs

We saw before that a chain of retainers can pin an object, such as a scope to a GC root:

{<38>}![TODO]()

We also saw that AngularJS scopes are part of a highly connected graph, meaning that if we leak part of it, we probably leak it all:

{<40>}![TODO]()

However, things can get worse. Remember how in an angular app you can get the scope for an element with `$(selector).scope()`? This connection between a scope an an element is maintained in the jQuery data cache. This lets us associate arbitrary data with an element. This introduces another layer of connectivity:

{<42>}![TODO]()

We can see here an alarming increase in the side and potential complexity of the graph. We've got DOM elements in play now. The chances are that if you are reading this you are dealing with a memory leak in your app, if it's noticable enough for you to deal with it, you probably have a non-trivial graph.

How can we deal with this?

Basically we have to avoid a set of anti-patterns, all of which are detailed below. There is another technique, which is to disconnect the graph. This is the last resort, but sometimes needed.

## Anti Patterns to Avoid

Most of these anti-patterns can be considered to be aspects of a simple rule:

> Long lived objects **must not** retain short lived objects.

In single page apps we are going to create a lot of short lived objects - scopes, views, directives and so on. We need to be able to clean these up and most of the time angular will do that for us. But it cannot if we retain these objects via long lived objects. And don't forget, when we leak, we really leak. TODO link to big graph.

#### Poorly Managed Event Handlers

Consider a trivial example in a directive link:

```javascript
function(scope, element, attrs) {
  element.on('click', function() {
    scope.selected = true;
  });
}
```

We register an event handler. We've now built a closure which will have a context, which retains the `scope`. If we don't deregister this event handler, we retain the closure, the context, the scope, and then basically everything in the universe.

*Note:*: In the trivial case angular *should* handle this. It is supposed to deregister event handlers on elements it manages. In my experience this isn't always the case, although it seems cases when this doesn't happen are fewer and fewer as bugs get fixed in the framework.

**The Fix**

```javascript
function(scope, element, attrs) {
  element.on('click', function() {
    scope.selected = true;
  });
  scope.$on('$destroy', function() {
  	element.off(); // deregister all event handlers
  })''
}
```

#### Poorly Managed Watchers

Basically the same as above.

```javascript
$scope.$on('someEvent', function() {
	$scope.refresh();
})
```

Again, Angular should clean this up if you forget to, but the advice is always do it yourself. Angular watchers return a deregister function.

**The Fix**

```javascript
var cleanup = $scope.$on('someEvent', function() {
	$scope.refresh();
});
$scope.$on('$destroy', function() {
	cleanup();
})
```

#### Callback Functions on Services

Services, or other long lived objects, should typically not take callback functions. Imagine a 'notification service', allowing a scope to discover if the user has changed their name:

```javascript
NotificationService.onNameChange(function(newName) {
	$scope.userName = newName;
});
```

Now the service (a long lived object) takes a closure with a context to a shore lived object, the scope. Unless the service is written absolutely correctly, we run the risk of the service retaining the scope. Remember, services are singletons and as such the interface between services and scopes is one that requires careful management.

There are two fixes I would suggest.

**Fix 1: For a one-off operation, use a promise**

```javascript
NotificationService.changeName().then(function(newName) {
	$scope.name = newName;
});
```

The notification service returns a promise (a short lived object) when holds the closure. If we get things wrong, we are less likely to leak the scope. Plus, promises are typically easy to work with once you've got the hang of them.

See my article [Promises in AngularJS - The Definitive Guide](http://www.dwmkerr.com/promises-in-angularjs-the-definitive-guide/) if you are not sure how to use them.

**Fix 2: For notifications, use broadcasts**

```javascript
$scope.$on('NotificationService:ChangeName', function(data) {
	$scope.name = data;
});
```

Some will say to not overuse broadcasts as they can be expensive. They can, so use them judiciously. But remember as well, they're provided by the framework, typically lead to fairly loose coupling and are probably managing clean up as well or better than a hand-rolled mechanism in a service.

## The Future

There are some important things that will happen over the next few years that will direcly help with issues like this.

#### Weak Maps

Finally, in ECMAScript 6 we will get a WeakMap object. This is *ideal* for something like the jQuery data cache. A weak map uses weak references (not natively supported in JavaScript). This means that we can map a DOM element to a scope in a weak map, but the map entry doesn't retain the element or scope. If the element or scope is cleaned up, the map entry is removed. This means internal structures to aid with frameworks don't need to necessarily retain object graphs.

#### AngularJS 2.0

Simplications to the framework in 2.0 and usage of native features like web components mean less complex framework code and less scope for issues. Consider even the usage of classes in Angular 2.0. We don't decorate a scope object (of type `Object`) we create an instance of a class. Easier to see in the heap view.

#### Even Better Browsers

SPA frameworks are driving improvements to browsers. Frameworks like Angular lead to more SPAs. More SPAs mean we find more bugs and edge cases in browsers. Many memory leak issues in AngularJS have led to fixes in V8.

#### Thanks

Much of my understanding here came from working with others on real-world issues. I would like to thank the following people for their advice and insights:

James Denning, Shaun Bohannon, Arnaud Rebts, Colin Montgommery, Jon Hamshaw, Christian Lilley, Maarten De Wilde

There are others I have worked on with in this area, if I have forgotten to mention you please let me know.

#### Mysteries

#### Mystery 1: False Charts

TODO documemt issue with snapshots VS memory usage graph and link to Chrome and Angular issues.

#### Mystery 2: Odd Snapshot Sizes

TODO

#### Mystery 3: Where's the colour coding documentation?