Dealing with memory leaks in JavaScript applications can be a complex process. In this article I'm going to show you how to identify whether you have memory leaks, analyse them and ultimately resolve them.

In this article I'm using an AngularJS application to demonstrate the concepts and approaches, but the majority of this material is not related to AngularJS and applies to any JavaScript application.

1. What are Memory Leaks?
2. Identifying Memory Leaks
3. Analysing Memory Leaks
4. Fixing Memory Leaks
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

#### Mystery 1: False Charts

TODO documemt issue with snapshots VS memory usage graph and link to Chrome and Angular issues.

When we record heap allocations we get a chart showing us spikes as we allocate memory. These spikes are initially blue (meaning Chrome is using the memory), then change to grey once the memory is freed. If we see spikes or sections of spikes that remain blue, we may have a problem.

Try this, go to the Ablums app and start recording. Click on the 'India' album, then go back to the home page. You should see a chart like this:

{<8>}![Heap Allocations Example 1](/content/images/2015/03/HeapAllocationsEx1.png)

So we start recording and nothing is being allocated. Then we click on the 'India' album (point 1) and we get a few spikes, as chrome allocates memory needed for the content in the new page. Then we click back on the home page (point 2). Some of the memory used in the India album is released (it looks like about half). One spike of memory used for the home page is still in use (what we'd expect) and another spike or two seem to be freed. These other spikes might be memory used for the actual transition, for example in logic in the router.

So this looks like we may have a problem in the album page. In fact, we can drag a selection box around those first three spikes and see what is *still* in memory (i.e. what might be a potential leak) in the view below:

{<10>}![Heap Allocations Example 2](/content/images/2015/03/HeapAllocationsEx2.png)

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

{<12>}![Heap Allocations Example 3](/content/images/2015/03/HeapAllocationsEx3.png)

This is looking good.

1. We go to the 'India' album. Some memory used is now freed, but much is still in use. As we saw, at least some of that is the template cache.
2. We go back to the home page, lots of memory is used but by the time we're done recording it's almost entirely freed.
3. We visit the India album a second time, requiring some memory almost all of which is freed.
4. We go back to the home page. Some memory is used during the transition and to render the page, some of that is still in use (which is expected as the page is still open).

The heap allocations chart is exceptionally useful in identifying memory leaks. The memory usage charts paint a broad picture, but it's this chart which has already led to insights:

1. Initial loading of pages increases our 'baseline' memory footprint due to data being added to caches (such as the AngularJS template cache).
2. Subsequent loading of pages requires memory, but the vast majority of it is freed.

One thing we noticed from this brief analyse was that the initial result was slightly misleading (at first). With the heap allocations view repeated operations can help you identify trends. In the Albums applications I've actually set up part of the app to run repeated operations, so we can try to consistently test scenarions. The 'scenarios' menu lets us run them. Let's try running scenario 1.

{<14>}![Scenario 1](/content/images/2015/03/Scenario1.png)

This scenario will navigate from `/` (the home page) to `/nowhere` ten times. `/nowhere` isn't matched by the router so takes us back to the home page. This has the effect of reloading the home page 20 times (just reloading doesn't work, the router is smart enough to realise we're staying on the same page).

{<17>}![Scenario 1 Heap Allocations](/content/images/2015/03/Scneario1HeapAllocations.png)

While you are recording the chart you can see peaks go from blue to grey as memory is freed. Let's see what we've got.

1. Shows our first navigation, some memory is not freed. Everything before this is setup code.
2. Our last navigation. Some memory still in use (as expected).
3. A glance at memory in use shows some compiled code and system data (more on this later). At this stage we don't need to worry, Chrome will allocate data like this when it needs to.
4. It looks like the 11th page load didn't free all of it's memory. This is potential cause for worry.

Altogether this a very healthy looking scenario. The huge majority of what we allocate is freed, as we would hope. Small amounts of memory stay in use (mostly used under the hood by Chrome) and a small amount of memory after the 11th reload is not freed (a quick look suggests a timing issue, definitely something we'd want to investigate further in a real-world app). Our allocations are in the 50 KB to 100 KB range and we're looking good.

Before we say goodbye to the Heap Allocations view (for now) let's do the same for Scenario 3 (moving from the home page to the top rated page 10 times).

{<19>}![TODO]()