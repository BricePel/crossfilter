var http=require("http"),
    fs = require("fs"),
  express=require("express"),
    crossfilter = require("./crossfilter.v1.min.js").crossfilter,
    app=express();


// Like d3.time.format, but faster.
  function parseDate(d) {
    return new Date(2001,
        d.substring(0, 2) - 1,
        d.substring(2, 4),
        d.substring(4, 6),
        d.substring(6, 8));
  }



var flights = fs.readFileSync("flights-3m.json","utf-8").toString().split("\r\n");
var header = flights[0].split(",")


flights = flights.slice(1).map(function(d) {
  var line = {};
  d.split(",").forEach(function(d,i) {
    line[header[i]] = d;
  })
  return line;
})


// A little coercion, since the CSV is untyped.
flights.forEach(function(d, i) {
  d.index = i;
  d.date = parseDate(d.date);
  d.delay = +d.delay;
  d.distance = +d.distance;
});

// Create the crossfilter for the relevant dimensions and groups.
var flight = crossfilter(flights),

dimensions = {
  date: flight.dimension(function(d) { var d = new Date(d.date); d.setHours(0,0,0,0); return d; }),
  hour: flight.dimension(function(d) { return d.date.getHours() + d.date.getMinutes() / 60; }),
  delay: flight.dimension(function(d) { return Math.max(-60, Math.min(149, d.delay)); }),
  distance: flight.dimension(function(d) { return Math.min(1999, d.distance); })
}

groups = {
  date : dimensions.date.group(),
  hour : dimensions.hour.group(Math.floor),
  delay : dimensions.delay.group(function(d) { return Math.floor(d / 10) * 10; }),
  distance : dimensions.distance.group(function(d) { return Math.floor(d / 50) * 50; })
}

var size = flight.size();
var all = flight.groupAll();

app.use("/flights-3m",function(req,res,next) {
  filter = req.param("filter") ? JSON.parse(req.param("filter")) : {}
  Object.keys(dimensions).forEach(function(dim) {
    if (filter[dim]) {
      if (typeof filter[dim][0] === 'string') filter[dim]=[new Date(filter[dim][0]),new Date(filter[dim][1])]
      dimensions[dim].filterRange(filter[dim])
    } else {
      dimensions[dim].filterAll()
    }
  })
  var results = {}
  Object.keys(groups).forEach(function(key) {
      results[key] = {values:groups[key].all(),top:groups[key].top(1)[0].value}
  })
  
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end((JSON.stringify(results)))
})

app.use("/",express.static("/crossfilter/", {maxAge: 0}))
console.log("listening to port 8888")
http.createServer(app).listen(8888)