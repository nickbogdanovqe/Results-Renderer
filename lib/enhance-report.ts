/**
 * Inject sticky Group/Sort toolbar into Aurora API Gateway live report HTML.
 * If the Probes table is missing, returns the original HTML unchanged.
 */
export function enhanceReportHtml(html: string): string {
  if (!/<table[\s\S]*?<tbody[\s\S]*?<tr/i.test(html)) {
    return html;
  }

  const styles = `
<style id="rr-enhance-styles">
  .rr-toolbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; align-items: center;
    margin: 0 0 1rem; padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.92); border: 1px solid var(--line, #e2e8f0);
    border-radius: 12px; backdrop-filter: blur(8px);
    box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
    font-size: 0.88rem;
  }
  .rr-toolbar label {
    display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 600;
    color: var(--ink, #0f172a);
  }
  .rr-toolbar select {
    font: inherit; border: 1px solid var(--line, #e2e8f0); border-radius: 8px;
    padding: 0.3rem 0.5rem; background: #fff; color: var(--ink, #0f172a);
  }
  .rr-toolbar .rr-hint { color: var(--muted, #64748b); font-weight: 500; margin-left: auto; }
  tr.rr-group-header td {
    background: #ecfdf5 !important; color: var(--accent, #0f766e);
    font-weight: 700; font-size: 0.8rem; letter-spacing: 0.03em;
    text-transform: uppercase; border-bottom: 1px solid var(--line, #e2e8f0);
    padding-top: 0.7rem; padding-bottom: 0.7rem;
  }
</style>`;

  const toolbar = `
<div class="rr-toolbar" id="rr-toolbar" role="region" aria-label="Group and sort probes">
  <label>Group by
    <select id="rr-group" aria-label="Group by">
      <option value="none">None</option>
      <option value="result">Result</option>
      <option value="endpoint">Endpoint</option>
      <option value="status">Status code</option>
    </select>
  </label>
  <label>Sort
    <select id="rr-sort" aria-label="Sort">
      <option value="default">Default</option>
      <option value="fail-first">Failed first</option>
      <option value="pass-first">Passed first</option>
    </select>
  </label>
  <span class="rr-hint">Shareable view controls</span>
</div>`;

  const script = `
<script id="rr-enhance-script">
(function () {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var table = document.querySelector(".table-card table") || document.querySelector("table");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
    if (!rows.length) return;

    var wrap = document.querySelector(".wrap");
    var toolbar = document.getElementById("rr-toolbar");
    if (toolbar && wrap && toolbar.parentElement !== wrap) {
      var probesHeading = null;
      var headings = wrap.querySelectorAll("h2");
      for (var i = 0; i < headings.length; i++) {
        if (/probes/i.test(headings[i].textContent || "")) { probesHeading = headings[i]; break; }
      }
      if (probesHeading) wrap.insertBefore(toolbar, probesHeading);
      else wrap.insertBefore(toolbar, wrap.firstChild);
    }

    var originals = rows.map(function (tr) { return tr.cloneNode(true); });

    function resultOf(tr) {
      if (tr.classList.contains("fail")) return "fail";
      if (tr.classList.contains("skip")) return "skip";
      if (tr.classList.contains("pass")) return "pass";
      var badge = tr.querySelector(".badge.fail, .badge.skip, .badge.pass");
      if (badge) {
        if (badge.classList.contains("fail")) return "fail";
        if (badge.classList.contains("skip")) return "skip";
        if (badge.classList.contains("pass")) return "pass";
      }
      return "unknown";
    }

    function endpointOf(tr) {
      var method = (tr.querySelector("code.method") || {}).textContent || "";
      var path = (tr.querySelector("code.path") || {}).textContent || "";
      method = String(method).trim();
      path = String(path).trim();
      if (!method && !path) return "(unknown)";
      return method ? method + " " + path : path;
    }

    function statusCodeOf(tr) {
      var nums = tr.querySelectorAll("td.num");
      if (nums.length) {
        var code = String(nums[0].textContent || "").trim();
        if (code) return code;
      }
      var cells = tr.querySelectorAll("td");
      if (cells.length >= 5) {
        var fallback = String(cells[4].textContent || "").trim();
        if (fallback) return fallback;
      }
      return "(unknown)";
    }

    var RESULT_RANK = {
      "fail-first": { fail: 0, skip: 1, pass: 2, unknown: 3 },
      "pass-first": { pass: 0, skip: 1, fail: 2, unknown: 3 }
    };

    function sortRows(list, sortMode) {
      if (sortMode === "default") return list.slice();
      var rank = RESULT_RANK[sortMode] || RESULT_RANK["fail-first"];
      return list.slice().sort(function (a, b) {
        var ra = rank[resultOf(a)] != null ? rank[resultOf(a)] : 9;
        var rb = rank[resultOf(b)] != null ? rank[resultOf(b)] : 9;
        if (ra !== rb) return ra - rb;
        return endpointOf(a).localeCompare(endpointOf(b));
      });
    }

    function groupHeader(label, count) {
      var tr = document.createElement("tr");
      tr.className = "rr-group-header";
      var td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = label + " (" + count + ")";
      tr.appendChild(td);
      return tr;
    }

    function keyFnFor(groupBy) {
      if (groupBy === "result") return resultOf;
      if (groupBy === "status") return statusCodeOf;
      return endpointOf;
    }

    function apply() {
      var groupEl = document.getElementById("rr-group");
      var sortEl = document.getElementById("rr-sort");
      var groupBy = groupEl ? groupEl.value : "none";
      var sortMode = sortEl ? sortEl.value : "default";

      var working = originals.map(function (tr) { return tr.cloneNode(true); });
      working = sortRows(working, sortMode);

      tbody.innerHTML = "";

      if (groupBy === "none") {
        working.forEach(function (tr) { tbody.appendChild(tr); });
        return;
      }

      var keyFn = keyFnFor(groupBy);
      var buckets = {};
      var order = [];
      working.forEach(function (tr) {
        var key = keyFn(tr);
        if (!buckets[key]) {
          buckets[key] = [];
          order.push(key);
        }
        buckets[key].push(tr);
      });

      if (groupBy === "result") {
        var preferred = sortMode === "pass-first"
          ? ["pass", "skip", "fail", "unknown"]
          : ["fail", "skip", "pass", "unknown"];
        order = preferred.filter(function (k) { return buckets[k]; }).concat(
          order.filter(function (k) { return preferred.indexOf(k) === -1; })
        );
      } else if (groupBy === "status") {
        order.sort(function (a, b) {
          var na = parseInt(a, 10);
          var nb = parseInt(b, 10);
          var aNum = !isNaN(na);
          var bNum = !isNaN(nb);
          if (aNum && bNum && na !== nb) return na - nb;
          if (aNum !== bNum) return aNum ? -1 : 1;
          return a.localeCompare(b);
        });
      } else {
        order.sort(function (a, b) { return a.localeCompare(b); });
      }

      order.forEach(function (key) {
        var list = buckets[key] || [];
        var label = groupBy === "status" && key !== "(unknown)" ? "HTTP " + key : key;
        tbody.appendChild(groupHeader(label, list.length));
        list.forEach(function (tr) { tbody.appendChild(tr); });
      });
    }

    var groupSelect = document.getElementById("rr-group");
    var sortSelect = document.getElementById("rr-sort");
    if (groupSelect) groupSelect.addEventListener("change", apply);
    if (sortSelect) sortSelect.addEventListener("change", apply);
  });
})();
</script>`;

  let out = html;
  if (!out.includes("id=\"rr-enhance-styles\"")) {
    if (out.includes("</head>")) {
      out = out.replace("</head>", `${styles}\n</head>`);
    } else {
      out = styles + out;
    }
  }

  if (!out.includes("id=\"rr-toolbar\"")) {
    if (out.includes('<div class="wrap">')) {
      out = out.replace('<div class="wrap">', `<div class="wrap">\n${toolbar}`);
    } else if (out.includes("<body>")) {
      out = out.replace("<body>", `<body>\n${toolbar}`);
    } else {
      out = toolbar + out;
    }
  }

  if (!out.includes("id=\"rr-enhance-script\"")) {
    if (out.includes("</body>")) {
      out = out.replace("</body>", `${script}\n</body>`);
    } else {
      out = out + script;
    }
  }

  return out;
}
