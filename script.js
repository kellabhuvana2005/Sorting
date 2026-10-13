let arr = [];
let paused = false;
let running = false;
let stepCount = 1;
let voiceOn = false;

/* ---------- UTILS ---------- */
// ✅ Fixed sleep for proper pause/resume
function sleep() {
    return new Promise(resolve => {
        let total = parseInt(document.getElementById("speed").value);
        let elapsed = 0;
        let interval = 20; // check every 20ms

        function step() {
            if (!paused) elapsed += interval; // only count time when not paused
            if (elapsed >= total) return resolve();
            setTimeout(step, interval);
        }

        step();
    });
}

function setArray() {
    const input = document.getElementById("arrayInput").value.trim();
    if (!input) {
        alert("Please enter an array");
        return;
    }
    arr = input.split(",").map(Number);
    document.getElementById("arrayText").innerText = `[${arr}]`;
}

function toggleDark() { document.body.classList.toggle("dark"); }
function pause() { paused = true; speechSynthesis.pause(); }
function resume() { paused = false; speechSynthesis.resume(); }

/* ---------- VOICE ---------- */
// ✅ Fixed speakChunks for pause/resume
async function speakChunks(sentences) {
    if (!voiceOn) return;
    for (let text of sentences) {
        // Wait if paused before starting speech
        while(paused) await new Promise(r => setTimeout(r, 50));

        // Cancel any previous speech
        speechSynthesis.cancel();

        let msg = new SpeechSynthesisUtterance(text);
        let done = false;

        msg.onend = () => done = true;
        speechSynthesis.speak(msg);

        // Wait for speech to finish, respecting pause
        while(!done) {
            if(paused) {
                speechSynthesis.pause();
                while(paused) await new Promise(r => setTimeout(r,50));
                speechSynthesis.resume();
            }
            await new Promise(r => setTimeout(r,50));
        }
    }
}

function toggleVoiceUI() {
    voiceOn = !voiceOn;
    const btn = document.getElementById("voiceBtn");
    btn.innerText = voiceOn ? "🔊 Voice ON" : "🔊 Voice OFF";
}

/* ---------- STEP VISUAL ---------- */
async function addStep(array, classes = {}, text = "") {
    document.getElementById("currentStep").innerText = stepCount;
    await sleep();

    const row = document.createElement("div");
    row.className = "step-row";

    const num = document.createElement("div");
    num.className = "step-num";
    num.innerText = "Step " + stepCount++;
    row.appendChild(num);

    array.forEach((v,i)=>{
        const b = document.createElement("div");
        b.className="box";
        b.innerText=v;

        if(classes.compare?.includes(i)) b.classList.add("compare");
        if(classes.swap?.includes(i)) b.classList.add("swap");
        if(classes.left?.includes(i)) b.classList.add("left-sub");
        if(classes.right?.includes(i)) b.classList.add("right-sub");
        if(classes.subarray?.includes(i)) b.classList.add("merge-pos");

        row.appendChild(b);
    });

    document.getElementById("steps").appendChild(row);

    // auto-generate log message if empty
    if(!text) {
        let messages = [];
        if(classes.compare) messages.push(`Comparing ${classes.compare.map(i=>array[i]).join(" and ")}`);
        if(classes.swap) messages.push(`Swapped ${classes.swap.map(i=>array[i]).join(" and ")}`);
        if(classes.left && classes.right) messages.push(`Left: [${classes.left.map(i=>array[i]).join(", ")}], Right: [${classes.right.map(i=>array[i]).join(", ")}]`);
        if(classes.subarray) messages.push(`Updated positions: [${classes.subarray.map(i=>array[i]).join(", ")}]`);
        text = messages.join("; ");
    }

    const log = document.createElement("div");
    log.innerText = `Step ${stepCount-1}: ${text}`;
    document.getElementById("log").appendChild(log);
    document.getElementById("log").scrollTop=document.getElementById("log").scrollHeight;
}

function range(l,r){ return Array.from({length: r-l+1},(_,i)=>i+l); }

/* ---------- SORTING ALGORITHMS ---------- */
async function bubbleSort() {
    let a = [...arr];
    for(let i=0;i<a.length;i++){
        for(let j=0;j<a.length-i-1;j++){
            await addStep(a,{compare:[j,j+1]});
            await speakChunks([`Comparing number ${a[j]} with number ${a[j+1]}`]);
            if(a[j]>a[j+1]){
                [a[j],a[j+1]]=[a[j+1],a[j]];
                await addStep(a,{swap:[j,j+1]});
                await speakChunks([`Swapped number ${a[j]} with number ${a[j+1]}`]);
            }
        }
    }
    return a;
}

async function selectionSort() {
    let a = [...arr];
    for(let i=0;i<a.length;i++){
        let min=i;
        for(let j=i+1;j<a.length;j++){
            await addStep(a,{compare:[min,j]});
            await speakChunks([`Finding minimum between number ${a[min]} and number ${a[j]}`]);
            if(a[j]<a[min]) min=j;
        }
        if(min!==i){
            [a[i],a[min]]=[a[min],a[i]];
            await addStep(a,{swap:[i,min]});
            await speakChunks([`Swapped number ${a[i]} with number ${a[min]}`]);
        }
    }
    return a;
}

async function insertionSort() {
    let a = [...arr];
    for(let i=1;i<a.length;i++){
        let key=a[i],j=i-1;
        while(j>=0 && a[j]>key){
            await addStep(a,{compare:[j,j+1]});
            await speakChunks([`Shifting number ${a[j]} to the right`]);
            a[j+1]=a[j]; j--;
        }
        a[j+1]=key;
        await addStep(a,{swap:[j+1]});
        await speakChunks([`Inserted number ${key} at position ${j+1}`]);
    }
    return a;
}

/* ---------- MERGE SORT ---------- */
async function mergeSort(a,l,r){
    if(l>=r) return;
    let m=Math.floor((l+r)/2);
    await addStep(a,{left:range(l,m),right:range(m+1,r)});
    await speakChunks([
        "Dividing array into two subarrays.",
        `Left subarray from index ${l} to ${m} contains ${a.slice(l,m+1).join(", ")}.`,
        `Right subarray from index ${m+1} to ${r} contains ${a.slice(m+1,r+1).join(", ")}.`
    ]);
    await mergeSort(a,l,m);
    await mergeSort(a,m+1,r);
    await merge(a,l,m,r);
}

async function merge(a,l,m,r){
    let L=a.slice(l,m+1), R=a.slice(m+1,r+1);
    let i=0,j=0,k=l;
    while(i<L.length && j<R.length){
        a[k]=L[i]<=R[j]?L[i++]:R[j++];
        await addStep(a,{subarray:[k]});
        await speakChunks([`Placing number ${a[k]} in merged position`]);
        k++;
    }
    while(i<L.length){ a[k]=L[i++]; await addStep(a,{subarray:[k]}); await speakChunks([`Copying number ${a[k]} from left subarray`]); k++; }
    while(j<R.length){ a[k]=R[j++]; await addStep(a,{subarray:[k]}); await speakChunks([`Copying number ${a[k]} from right subarray`]); k++; }
}

/* ---------- QUICK SORT ---------- */
async function quickSort(a,l,h){
    if(l<h){
        await addStep(a,{subarray:range(l,h)});
        await speakChunks([
            `Sorting subarray from index ${l} to ${h}.`,
            `Current elements are: ${a.slice(l,h+1).join(", ")}.`
        ]);
        let p=await partition(a,l,h);
        await quickSort(a,l,p-1);
        await quickSort(a,p+1,h);
    }
}

async function partition(a,l,h){
    let pivot=a[h],i=l-1;
    for(let j=l;j<h;j++){
        await addStep(a,{compare:[j,h]});
        await speakChunks([`Comparing number ${a[j]} with pivot number ${pivot} at index ${h}`]);
        if(a[j]<pivot){
            i++; [a[i],a[j]]=[a[j],a[i]];
            await addStep(a,{swap:[i,j]});
            await speakChunks([`Swapped number ${a[i]} with number ${a[j]}`]);
        }
    }
    [a[i+1],a[h]]=[a[h],a[i+1]];
    await addStep(a,{swap:[i+1,h]});
    await speakChunks([`Pivot number ${pivot} placed at index ${i+1}`]);
    return i+1;
}

/* ---------- START ---------- */
async function start(type){
    if(running) return;
    if(arr.length===0){ alert("Enter array first"); return; }

    running=true;
    paused=false;
    stepCount=1;
    document.getElementById("steps").innerHTML="";
    document.getElementById("log").innerHTML="";
    document.getElementById("finalResult").innerText="";
    document.getElementById("currentStep").innerText=0;

    let result;
    if(type==="bubble") result=await bubbleSort();
    if(type==="selection") result=await selectionSort();
    if(type==="insertion") result=await insertionSort();
    if(type==="merge"){ let a=[...arr]; await mergeSort(a,0,a.length-1); result=a; }
    if(type==="quick"){ let a=[...arr]; await quickSort(a,0,a.length-1); result=a; }

    document.getElementById("finalResult").innerText="Final sorted array is: ["+result+"]";

    // Voice: announce final sorted array
    await speakChunks([`The array is sorted. Final array is: ${result.join(", ")}`]);

    running=false;
}
