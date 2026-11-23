#!/bin/sh
cd "$(dirname "$0")"
{ cat head.html; echo "<script>"; cat core.js ui.js sheets.js; echo "</script>"; echo "</body>"; echo "</html>"; } > ../index.html
