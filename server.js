const express = require("express");
const path = require("path");

const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Tracker listening on port ${port}`));
