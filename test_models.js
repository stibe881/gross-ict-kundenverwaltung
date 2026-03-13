fetch("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyCqyYzCotOHk7NF_xk03ci-B0nDRkuzOOg")
.then(r => r.json())
.then(d => console.log(d.models.map(m => m.name).join("\n")))
.catch(console.error);
