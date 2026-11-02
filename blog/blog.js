// Blog: article list + knowledge graph (index) and article reader (post).
(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const page = document.body.dataset.page;
  const PORTFOLIO_PROJECTS = "../#projects";

  // ---------- shared: theme toggle (same preference as the portfolio), year, tile glow ----------
  const root = document.documentElement;
  $("#themeToggle").addEventListener("click", () => {
    const cur = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    root.dataset.theme = cur === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });
  $("#year").textContent = new Date().getFullYear();
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest?.(".tile"); if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${e.clientX - r.left}px`); t.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });

  // ---------- graph data: posts, projects and topics ----------
  function buildGraph(posts, projects) {
    const nodes = [], links = [], seen = new Set(), ids = new Set();
    const add = (n) => { if (!ids.has(n.id)) { ids.add(n.id); nodes.push(n); } };
    const link = (a, b) => { const k = a < b ? a + "|" + b : b + "|" + a; if (a !== b && !seen.has(k)) { seen.add(k); links.push({ source: a, target: b }); } };
    const projIds = new Set(projects.map((p) => p.id)), postIds = new Set(posts.map((p) => p.slug));
    projects.forEach((p) => {
      add({ id: "project:" + p.id, label: p.title.replace(/\s*\(.*\)$/, ""), type: "project", ref: p });
      p.topics.forEach((t) => { add({ id: "tag:" + t, label: t, type: "tag" }); link("project:" + p.id, "tag:" + t); });
    });
    posts.forEach((p) => {
      add({ id: "post:" + p.slug, label: p.title, type: "post", ref: p });
      p.tags.forEach((t) => { add({ id: "tag:" + t, label: t, type: "tag" }); link("post:" + p.slug, "tag:" + t); });
      [...(p.related || []), ...(p.links || [])].forEach((x) => {
        if (projIds.has(x)) link("post:" + p.slug, "project:" + x);
        else if (postIds.has(x)) link("post:" + p.slug, "post:" + x);
      });
    });
    return { nodes, links };
  }
  const nodeUrl = (n) => n.type === "post" ? `post.html?p=${encodeURIComponent(n.ref.slug)}` : n.type === "project" ? PORTFOLIO_PROJECTS : `./?tag=${encodeURIComponent(n.label)}`;

  // ================= INDEX =================
  function index() {
    Promise.all([getJSON("posts/index.json"), getJSON("projects.json")]).then(([posts, projects]) => {
      const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
      const topics = [...new Set([...posts.flatMap((p) => p.tags), ...projects.flatMap((p) => p.topics)])];
      const stats = $("#blogStats");
      [[posts.length, "articles"], [topics.length, "topics"], [projects.length, "linked projects"]].forEach(([n, l]) => {
        const li = el("li"); li.append(el("b", null, String(n)), document.createTextNode(" " + l)); stats.append(li);
      });

      // Graph
      const { nodes, links } = buildGraph(posts, projects);
      const hint = $("#graphHint"), hintText = hint.textContent;
      const g = window.KnowledgeGraph($("#graphCanvas"), {
        nodes, links, zoom: innerWidth < 700 ? 0.75 : 1,
        onOpen: (n) => {
          if (n.type === "tag") { setTag(n.label); document.getElementById("postsTitle").scrollIntoView({ behavior: "smooth" }); }
          else location.href = nodeUrl(n);
        },
        onHover: (n) => {
          hint.textContent = !n ? hintText : n.type === "post" ? `Article · ${n.ref.title} · click to read`
            : n.type === "project" ? `Portfolio project · ${n.ref.title} · click to view` : `Topic · #${n.label} · click to filter articles`;
        },
      });
      $("#zoomIn").addEventListener("click", () => g.zoom(1.25));
      $("#zoomOut").addEventListener("click", () => g.zoom(0.8));
      $("#zoomReset").addEventListener("click", () => g.reset());

      // List + filters
      const params = new URLSearchParams(location.search);
      let tag = params.get("tag") || "all";
      const postTags = ["all", ...new Set(posts.flatMap((p) => p.tags))];
      if (!postTags.includes(tag)) tag = "all";
      const filters = $("#filters");
      postTags.forEach((t) => {
        const b = el("button", "filter", t === "all" ? "All" : "#" + t); b.type = "button"; b.dataset.tag = t;
        b.addEventListener("click", () => setTag(t)); filters.append(b);
      });
      function setTag(t) {
        tag = postTags.includes(t) ? t : "all";
        filters.querySelectorAll(".filter").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === tag)));
        g.setFocus(tag === "all" ? null : "tag:" + tag);
        render();
      }
      function render() {
        const q = $("#search").value.trim().toLowerCase();
        const shown = posts.filter((p) => (tag === "all" || p.tags.includes(tag)) && (!q || `${p.title} ${p.summary} ${p.tags.join(" ")}`.toLowerCase().includes(q)));
        $("#posts").replaceChildren(...shown.map((p) => {
          const a = Object.assign(el("a", "tile post-card"), { href: `post.html?p=${encodeURIComponent(p.slug)}` });
          const t = el("time", null, fmtDate(p.date)); t.dateTime = p.date;
          const body = el("div"); body.append(el("h3", null, p.title));
          if (p.summary) body.append(el("p", null, p.summary));
          const chips = el("ul", "chips");
          p.tags.forEach((x) => chips.append(el("li", null, "#" + x)));
          [...new Set([...(p.related || []), ...(p.links || [])])].filter((x) => projById[x]).forEach((x) => chips.append(el("li", "chip-proj", "◆ " + projById[x].title.replace(/\s*\(.*\)$/, ""))));
          const mins = el("li", null, `${p.minutes} min read`); chips.append(mins);
          body.append(chips); a.append(t, body); return a;
        }));
        if (!shown.length) $("#posts").append(el("p", "empty", "No articles match. Try another topic or search."));
        $("#count").textContent = `${shown.length} of ${posts.length}`;
      }
      $("#search").addEventListener("input", render);
      setTag(tag);
    }).catch(() => { $("#posts").append(el("p", "empty", "Could not load articles.")); });
  }

  // ================= POST =================
  function post() {
    const slug = new URLSearchParams(location.search).get("p");
    const fail = (m) => { $("#postTitle").textContent = "Article not found"; $("#article").replaceChildren(el("p", "empty", m)); };
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug || "")) return fail("This link looks broken. Head back to the blog.");

    Promise.all([getJSON("posts/index.json"), getJSON("projects.json"), fetch(`posts/${slug}.md`).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))])
      .then(([posts, projects, md]) => {
        const i = posts.findIndex((p) => p.slug === slug);
        const meta = posts[i] || { slug, title: slug, date: "", tags: [], related: [], links: [], minutes: 1 };
        const postBy = Object.fromEntries(posts.map((p) => [p.slug, p]));
        const projBy = Object.fromEntries(projects.map((p) => [p.id, p]));
        document.title = `${meta.title} · Blog · Devisetty Lakshmi Srinivas`;
        $("#postTitle").textContent = meta.title;
        $("#postMeta").textContent = [meta.date && fmtDate(meta.date), `${meta.minutes} min read`].filter(Boolean).join(" · ");
        meta.tags.forEach((t) => $("#postTags").append(Object.assign(el("a", null, "#" + t), { href: `./?tag=${encodeURIComponent(t)}` })));

        // [[wikilinks]] -> links to posts or portfolio projects.
        let body = md.replace(/^---[\s\S]*?\n---\s*\n/, "").replace(/<!--[\s\S]*?-->/g, "");
        body = body.replace(/\[\[([a-z0-9][a-z0-9-]*)(?:\|([^\]]+))?\]\]/gi, (m, id, text) => {
          id = id.toLowerCase();
          if (postBy[id]) return `<a class="wikilink" href="post.html?p=${id}">${(text || postBy[id].title).replace(/</g, "&lt;")}</a>`;
          if (projBy[id]) return `<a class="wikilink proj" href="${PORTFOLIO_PROJECTS}">${(text || projBy[id].title).replace(/</g, "&lt;")}</a>`;
          return (text || id).replace(/</g, "&lt;");
        });
        const html = window.marked ? marked.parse(body) : body.replace(/</g, "&lt;");
        $("#article").innerHTML = window.DOMPurify ? DOMPurify.sanitize(html) : html;
        $("#article").querySelectorAll("img").forEach((img) => { const s = img.getAttribute("src"); if (s && !/^(https?:|\/|data:)/.test(s)) img.src = "posts/" + s; img.loading = "lazy"; img.decoding = "async"; });
        $("#article").querySelectorAll("a[href^='http']").forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });

        // Related projects
        const rel = [...new Set([...(meta.related || []), ...(meta.links || [])])].filter((x) => projBy[x]);
        if (rel.length) {
          $("#relatedTile").hidden = false;
          rel.forEach((x) => { const li = el("li"), a = Object.assign(el("a", null, projBy[x].title), { href: PORTFOLIO_PROJECTS }); a.append(el("small", null, projBy[x].summary)); li.append(a); $("#related").append(li); });
        }
        // Backlinks: other posts that link here.
        const back = posts.filter((p) => p.slug !== slug && (p.links || []).includes(slug));
        if (back.length) back.forEach((p) => { const li = el("li"), a = Object.assign(el("a", null, p.title), { href: `post.html?p=${p.slug}` }); a.append(el("small", null, fmtDate(p.date))); li.append(a); $("#backlinks").append(li); });
        else $("#backlinks").append(el("li", "none", "No other articles link here yet."));

        // Local graph: this post plus everything within two hops.
        const full = buildGraph(posts, projects);
        const me = "post:" + slug, keep = new Set([me]);
        for (let hop = 0; hop < 2; hop++) {
          full.links.forEach((l) => { if (keep.has(l.source) || keep.has(l.target)) { keep.add(l.source); keep.add(l.target); } });
          if (keep.size > 40) break;
        }
        window.KnowledgeGraph($("#localGraph"), {
          nodes: full.nodes.filter((n) => keep.has(n.id)),
          links: full.links.filter((l) => keep.has(l.source) && keep.has(l.target)),
          focus: me, zoom: 0.8, labelsAt: 0.7,
          onOpen: (n) => { if (n.id !== me) location.href = nodeUrl(n); },
        });

        // Prev / next
        const nav = $("#postNav"), newer = posts[i - 1], older = posts[i + 1];
        if (older) { const a = Object.assign(el("a", "prev"), { href: `post.html?p=${older.slug}` }); a.append(el("small", null, "← Older"), el("b", null, older.title)); nav.append(a); }
        if (newer) { const a = Object.assign(el("a", "next"), { href: `post.html?p=${newer.slug}` }); a.append(el("small", null, "Newer →"), el("b", null, newer.title)); nav.append(a); }
      })
      .catch(() => fail("This article could not be loaded."));

    const bar = $("#progress");
    addEventListener("scroll", () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    }, { passive: true });
  }

  ({ index, post })[page]?.();
})();
