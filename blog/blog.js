// Blog: article list + knowledge graph (index) and article reader (post).
(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const page = document.body.dataset.page;
  const PORTFOLIO_PROJECTS = "../#projects";
  const shortTitle = (t) => t.replace(/\s*\(.*\)$/, "");

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

  // ---------- graph data: posts, projects, GitHub notes and topics ----------
  function buildGraph(posts, projects, notes) {
    const nodes = [], links = [], seen = new Set(), ids = new Set();
    const add = (n) => { if (!ids.has(n.id)) { ids.add(n.id); nodes.push(n); } };
    const link = (a, b) => { const k = a < b ? a + "|" + b : b + "|" + a; if (a !== b && !seen.has(k)) { seen.add(k); links.push({ source: a, target: b }); } };
    const projIds = new Set(projects.map((p) => p.id)), postIds = new Set(posts.map((p) => p.slug)), noteIds = new Set(notes.map((n) => n.id));
    const topicLinks = (id, topics) => topics.forEach((t) => { add({ id: "tag:" + t, label: t, type: "tag" }); link(id, "tag:" + t); });
    projects.forEach((p) => { add({ id: "project:" + p.id, label: shortTitle(p.title), type: "project", ref: p }); topicLinks("project:" + p.id, p.topics); });
    notes.forEach((n) => { add({ id: "note:" + n.id, label: n.title, type: "note", ref: n }); topicLinks("note:" + n.id, n.topics); });
    posts.forEach((p) => {
      add({ id: "post:" + p.slug, label: p.title, type: "post", ref: p });
      topicLinks("post:" + p.slug, p.tags);
      [...(p.related || []), ...(p.links || [])].forEach((x) => {
        if (projIds.has(x)) link("post:" + p.slug, "project:" + x);
        else if (noteIds.has(x)) link("post:" + p.slug, "note:" + x);
        else if (postIds.has(x)) link("post:" + p.slug, "post:" + x);
      });
    });
    return { nodes, links };
  }
  const nodeUrl = (n) => n.type === "post" ? `post.html?p=${encodeURIComponent(n.ref.slug)}`
    : n.type === "project" ? PORTFOLIO_PROJECTS : n.type === "note" ? n.ref.url : `./?tag=${encodeURIComponent(n.label)}`;
  const openNode = (n) => { const u = nodeUrl(n); if (n.type === "note") window.open(u, "_blank", "noopener"); else location.href = u; };
  // Pages the reader has opened, shown in a different shade in the graphs (like Quartz).
  const VISITED_KEY = "blog-visited";
  const getVisited = () => { try { return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || "[]")); } catch (e) { return new Set(); } };
  const markVisited = (id) => { try { const v = getVisited(); v.add(id); localStorage.setItem(VISITED_KEY, JSON.stringify([...v])); } catch (e) {} };

  // Fullscreen global graph, opened from the expand button next to each graph.
  function openGlobalGraph(data, focusId) {
    const overlay = el("div", "graph-modal");
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", "Global graph");
    const box = el("div", "graph-modal-box");
    const head = el("div", "graph-modal-head");
    head.append(el("h2", null, "Global graph"), el("span", "graph-modal-hint", "Drag · scroll or pinch to zoom · click a node to open"));
    const close = Object.assign(el("button", "gbtn-s graph-modal-close", "✕"), { type: "button" });
    close.setAttribute("aria-label", "Close global graph");
    head.append(close);
    const canvas = el("canvas", "graph-canvas modal");
    box.append(head, canvas); overlay.append(box); document.body.append(overlay);
    document.body.style.overflow = "hidden";
    const g = window.KnowledgeGraph(canvas, { nodes: data.nodes, links: data.links, mode: "global", focus: focusId, visited: getVisited(), onOpen: openNode });
    const shut = () => { g.destroy(); overlay.remove(); document.body.style.overflow = ""; removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") shut(); };
    close.addEventListener("click", shut);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) shut(); });
    addEventListener("keydown", onKey);
    close.focus();
  }

  const loadAll = () => Promise.all([getJSON("posts/index.json"), getJSON("projects.json"), getJSON("notes.json").catch(() => [])]);

  // ================= INDEX =================
  function index() {
    loadAll().then(([posts, projects, notes]) => {
      const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
      const noteById = Object.fromEntries(notes.map((n) => [n.id, n]));
      const topics = [...new Set([...posts.flatMap((p) => p.tags), ...projects.flatMap((p) => p.topics), ...notes.flatMap((n) => n.topics)])];
      const stats = $("#blogStats");
      [[posts.length, "article"], [notes.length, "GitHub note"], [projects.length, "linked project"], [topics.length, "topic"]].forEach(([n, l]) => {
        const li = el("li"); li.append(el("b", null, String(n)), document.createTextNode(" " + (n === 1 ? l : l + "s"))); stats.append(li);
      });

      // Graph + hover card
      const { nodes, links } = buildGraph(posts, projects, notes);
      const tip = $("#graphTip");
      if (matchMedia("(pointer: coarse)").matches) $("#graphHint").textContent = "Tap a node to open it · drag nodes sideways · use + and − to zoom";
      const KIND = { post: "Article", project: "Portfolio project", note: "GitHub note", tag: "Topic" };
      const ACTION = { post: "Click to read", project: "Click to view in portfolio", note: "Click to open on GitHub", tag: "Click to filter articles" };
      const g = window.KnowledgeGraph($("#graphCanvas"), {
        nodes, links, mode: "global", visited: getVisited(),
        onOpen: (n) => {
          if (n.type === "tag") { setTag(n.label); document.getElementById("postsTitle").scrollIntoView({ behavior: "smooth" }); }
          else openNode(n);
        },
        onHover: (n, x, y) => {
          if (!n) { tip.hidden = true; return; }
          const summary = n.ref?.summary || "";
          tip.innerHTML = `<small>${KIND[n.type]}</small><b>${esc(n.type === "tag" ? "#" + n.label : n.ref?.title || n.label)}</b>${summary ? `<span>${esc(summary)}</span><br>` : ""}<small style="margin-top:6px">${ACTION[n.type]}</small>`;
          const w = tip.parentElement.clientWidth;
          tip.style.left = Math.min(Math.max(x, 140), w - 140) + "px"; tip.style.top = Math.max(y, 120) + "px";
          tip.hidden = false;
        },
      });
      $("#zoomIn").addEventListener("click", () => g.zoom(1.25));
      $("#zoomOut").addEventListener("click", () => g.zoom(0.8));
      $("#zoomReset").addEventListener("click", () => { $("#graphFind").value = ""; g.reset(); g.setFocus(tag === "all" ? null : "tag:" + tag); });
      $("#graphFind").addEventListener("input", (e) => g.find(e.target.value));
      $("#graphExpand")?.addEventListener("click", () => openGlobalGraph({ nodes, links }, tag === "all" ? null : "tag:" + tag));
      const hidden = new Set();
      document.querySelectorAll(".lg").forEach((b) => b.addEventListener("click", () => {
        const t = b.dataset.type, on = b.getAttribute("aria-pressed") === "true";
        b.setAttribute("aria-pressed", String(!on)); on ? hidden.add(t) : hidden.delete(t);
        g.setHidden(hidden);
      }));

      // List + filters
      let tag = new URLSearchParams(location.search).get("tag") || "all";
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
          const refs = [...new Set([...(p.related || []), ...(p.links || [])])];
          refs.filter((x) => projById[x]).forEach((x) => chips.append(el("li", "chip-proj", "◆ " + shortTitle(projById[x].title))));
          const nNotes = refs.filter((x) => noteById[x]).length;
          if (nNotes) chips.append(el("li", "chip-note", `${nNotes} GitHub note${nNotes > 1 ? "s" : ""}`));
          chips.append(el("li", null, `${p.minutes} min read`));
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

    Promise.all([loadAll(), fetch(`posts/${slug}.md`).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))])
      .then(([[posts, projects, notes], md]) => {
        const i = posts.findIndex((p) => p.slug === slug);
        const meta = posts[i] || { slug, title: slug, date: "", tags: [], related: [], links: [], minutes: 1 };
        const postBy = Object.fromEntries(posts.map((p) => [p.slug, p]));
        const projBy = Object.fromEntries(projects.map((p) => [p.id, p]));
        const noteBy = Object.fromEntries(notes.map((n) => [n.id, n]));
        document.title = `${meta.title} · Blog · Devisetty Lakshmi Srinivas`;
        $("#postTitle").textContent = meta.title;
        $("#postMeta").textContent = [meta.date && fmtDate(meta.date), `${meta.minutes} min read`].filter(Boolean).join(" · ");
        meta.tags.forEach((t) => $("#postTags").append(Object.assign(el("a", null, "#" + t), { href: `./?tag=${encodeURIComponent(t)}` })));

        // [[wikilinks]] -> posts, portfolio projects or GitHub notes.
        let body = md.replace(/^---[\s\S]*?\n---\s*\n/, "").replace(/<!--[\s\S]*?-->/g, "");
        body = body.replace(/\[\[([a-z0-9][a-z0-9-]*)(?:\|([^\]]+))?\]\]/gi, (m, id, text) => {
          id = id.toLowerCase();
          if (postBy[id]) return `<a class="wikilink" href="post.html?p=${id}">${esc(text || postBy[id].title)}</a>`;
          if (projBy[id]) return `<a class="wikilink proj" href="${PORTFOLIO_PROJECTS}">${esc(text || projBy[id].title)}</a>`;
          if (noteBy[id]) return `<a class="wikilink note" href="${noteBy[id].url}">${esc(text || noteBy[id].title)}</a>`;
          return esc(text || id);
        });
        const html = window.marked ? marked.parse(body) : esc(body);
        $("#article").innerHTML = window.DOMPurify ? DOMPurify.sanitize(html) : html;
        $("#article").querySelectorAll("img").forEach((img) => { const s = img.getAttribute("src"); if (s && !/^(https?:|\/|data:)/.test(s)) img.src = "posts/" + s; img.loading = "lazy"; img.decoding = "async"; });
        $("#article").querySelectorAll("a[href^='http']").forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });

        // Code blocks -> terminal windows. In shell blocks, "$ " lines are commands,
        // "# " lines are comments and anything else is output. A first line like
        // "# file: /etc/foo.toml" becomes the window title.
        $("#article").querySelectorAll("pre > code").forEach((code) => {
          const pre = code.parentElement;
          const lang = ((code.className.match(/language-(\S+)/) || [])[1] || "").toLowerCase();
          let lines = code.textContent.replace(/\n$/, "").split("\n");
          // Only blocks with "$ " prompts get command/output colouring; scripts stay plain.
          const shell = /^(bash|sh|shell|console|zsh|fish)$/.test(lang) && lines.some((l) => l.startsWith("$ "));
          let title = shell ? "zerobyte@fedora: ~" : lang || "text";
          const file = lines[0].match(/^(?:#|\/\/)\s*file:\s*(.+)$/i);
          if (file) { title = file[1].trim(); lines = lines.slice(1); }
          // Tag each line; a line after a command ending in "\" continues that command.
          let cont = false;
          const kinds = lines.map((l) => {
            const k = l.startsWith("$ ") ? "cmd" : cont ? "more" : /^#( |$)/.test(l) ? "comment" : "out";
            cont = (k === "cmd" || k === "more") && /\\\s*$/.test(l);
            return k;
          });
          const copyText = shell
            ? lines.flatMap((l, i) => kinds[i] === "cmd" ? [l.slice(2)] : kinds[i] === "more" ? [l] : []).join("\n")
            : lines.join("\n");
          if (shell) {
            code.innerHTML = lines.map((l, i) =>
              kinds[i] === "cmd" ? `<span class="t-prompt">$</span> <span class="t-cmd">${esc(l.slice(2))}</span>`
              : kinds[i] === "more" ? `<span class="t-cmd">${esc(l)}</span>`
              : kinds[i] === "comment" ? `<span class="t-comment">${esc(l)}</span>`
              : `<span class="t-out">${esc(l)}</span>`).join("\n");
          } else code.textContent = lines.join("\n");

          const term = el("div", "term"), bar = el("div", "term-bar");
          const copy = Object.assign(el("button", "term-copy", "Copy"), { type: "button" });
          copy.setAttribute("aria-label", "Copy commands");
          copy.addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(copyText); copy.textContent = "Copied"; }
            catch (e) { copy.textContent = "Failed"; }
            setTimeout(() => { copy.textContent = "Copy"; }, 1500);
          });
          bar.append(el("span", "term-dots"), el("span", "term-title", title), copy);
          pre.replaceWith(term);
          term.append(bar, pre);
        });

        // Sidebar: related projects, linked GitHub notes, backlinks
        const refs = [...new Set([...(meta.related || []), ...(meta.links || [])])];
        const rel = refs.filter((x) => projBy[x]);
        if (rel.length) {
          $("#relatedTile").hidden = false;
          rel.forEach((x) => { const li = el("li"), a = Object.assign(el("a", null, projBy[x].title), { href: PORTFOLIO_PROJECTS }); a.append(el("small", null, projBy[x].summary)); li.append(a); $("#related").append(li); });
        }
        const linkedNotes = refs.filter((x) => noteBy[x]);
        if (linkedNotes.length) {
          $("#notesTile").hidden = false;
          linkedNotes.forEach((x) => { const li = el("li"), a = Object.assign(el("a", null, noteBy[x].title + " ↗"), { href: noteBy[x].url, target: "_blank", rel: "noopener" }); a.append(el("small", null, noteBy[x].summary)); li.append(a); $("#notes").append(li); });
        }
        const back = posts.filter((p) => p.slug !== slug && (p.links || []).includes(slug));
        if (back.length) back.forEach((p) => { const li = el("li"), a = Object.assign(el("a", null, p.title), { href: `post.html?p=${p.slug}` }); a.append(el("small", null, fmtDate(p.date))); li.append(a); $("#backlinks").append(li); });
        else $("#backlinks").append(el("li", "none", "No other articles link here yet."));

        // Local graph: this post and what it links to directly (depth 1, like Quartz).
        const full = buildGraph(posts, projects, notes);
        const me = "post:" + slug, keep = new Set([me]);
        markVisited(me);
        full.links.forEach((l) => { if (l.source === me) keep.add(l.target); if (l.target === me) keep.add(l.source); });
        window.KnowledgeGraph($("#localGraph"), {
          nodes: full.nodes.filter((n) => keep.has(n.id)),
          links: full.links.filter((l) => keep.has(l.source) && keep.has(l.target)),
          mode: "local", focus: me, visited: getVisited(),
          onOpen: (n) => { if (n.id !== me) openNode(n); },
        });
        $("#graphExpand")?.addEventListener("click", () => openGlobalGraph(full, me));

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

// Mobile menu: the nav opens as a dropdown under the dock below 920px.
(() => {
  const dock = document.querySelector(".dock"), btn = document.getElementById("menuBtn");
  if (!dock || !btn) return;
  const set = (open) => { dock.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
  btn.addEventListener("click", () => set(!dock.classList.contains("open")));
  dock.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => set(false)));
  document.addEventListener("click", (e) => { if (!dock.contains(e.target)) set(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  addEventListener("resize", () => { if (innerWidth > 920) set(false); }, { passive: true });
})();
