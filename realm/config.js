// =====================================================================
//  404 REALM: gaming page data. Edit this file to update the page.
//  Anything left empty ("" or []) is hidden automatically.
// =====================================================================
window.REALM = {
  player: {
    tag: "VOIDSORROW",
    title: "Developer · Gamer · root@fedora",
    bio: "Off the grid, I live in the terminal, chase lower latency across multiple kernels and dig into how games are built. This is my corner of the internet for all of it.",
    // Degree progress drives the XP bar. Change the quest when the next one starts.
    quest: { name: "M.Tech AI & ML", start: "2024-08-01", end: "2026-12-31" },
  },

  // Extra lines shown in the live ticker under the header.
  tips: [
    "Join the 404 Realm Discord to talk games, code and data",
    "Articles live on the blog, linked in a knowledge graph",
  ],

  // Gamer handles, shown in "Lobby". Only filled-in rows are shown.
  // Tracker Network profiles (e.g. Valorant) come from data/profiles.json -> tracker and are added automatically.
  handles: [
    { platform: "Discord server", handle: "404 Realm", url: "https://discord.gg/ZbmZp9K2Pb", icon: "discord" },
    { platform: "Discord", handle: "zerobyte57", url: "https://discord.com/users/1511750310970785922", icon: "discord" },
    { platform: "Steam", handle: "VOIDSORROW57", url: "https://steamcommunity.com/profiles/76561199191324058", icon: "steam" },
    { platform: "Xbox", handle: "Voidsorrow38", url: "https://account.xbox.com/en-us/profile?gamertag=Voidsorrow38", icon: "xbox" },
    { platform: "Clash of Clans", handle: "#PL0Q89L99", url: "https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=PL0Q89L99", icon: "coc" },
    { platform: "X / Twitter", handle: "@voidsorrow57", url: "https://x.com/voidsorrow57", icon: "x" },
  ],

  gaming: {
    // Discord server widget (live). Server Settings -> Widget must stay enabled.
    discordGuildId: "1513577285184389160",
    discordInvite: "ZbmZp9K2Pb",
    // Live personal Discord status via Lanyard needs your numeric Discord user ID (not the username):
    // Discord -> Settings -> Advanced -> Developer Mode on, then right-click your name -> Copy User ID.
    // Also join discord.gg/lanyard once with your account.
    discordUserId: "1511750310970785922",
  },

  // Games added by hand. Steam games (once the profile is public) and Tracker Network
  // games (Valorant) are added to the library automatically.
  // status: "playing" | "favourite" | "completed" | "backlog"   hours: optional playtime
  games: [
    { title: "Black Myth: Wukong", platform: "PC", genre: "Action RPG", status: "completed" },
    { title: "Subnautica", platform: "PC", genre: "Survival", status: "completed" },
    { title: "Clash of Clans", platform: "Mobile", genre: "Strategy", status: "playing", note: "Player tag #PL0Q89L99" },
  ],

  // "My rig": the laptop drawing sits between `specs` (left) and `accessories` (right).
  rig: {
    name: "ASUS ROG Strix G16",
    model: "G614JV · 2023 · 16-inch gaming laptop",
    specs: [
      { label: "CPU", value: "Intel Core i7-13650HX", detail: "14 cores · 13th gen", icon: "cpu" },
      { label: "GPU", value: "NVIDIA GeForce RTX 4060 Laptop", detail: "8 GB GDDR6", icon: "gpu" },
      { label: "Memory", value: "16 GB DDR5", detail: "4800 MT/s", icon: "ram" },
      { label: "Storage", value: "2 TB NVMe SSD", detail: "WD_BLACK SN850X 1 TB + Micron 2400 1 TB", icon: "ssd" },
      { label: "Display", value: "16\" 1920 × 1200", detail: "165 Hz", icon: "display" },
      { label: "Daily OS", value: "Fedora Linux", detail: "Custom CachyOS kernel + stock Fedora kernel", icon: "os" },
      { label: "Also runs", value: "Windows 11", detail: "Distros used: Fedora · CachyOS · Ubuntu · Garuda", icon: "os" },
    ],
    accessories: [
      { label: "Keyboard", value: "Ant Esports Apex 100 Mini", detail: "", icon: "keyboard" },
      { label: "Mouse", value: "Razer DeathAdder V3", detail: "", icon: "mouse" },
      { label: "Headset", value: "boAt Rockerz 650 Pro", detail: "", icon: "headset" },
      { label: "Controller", value: "Cosmic Byte Ares Pro", detail: "", icon: "pad" },
    ],
  },

  // Developer profiles shown in the footer.
  devLinks: [
    { label: "GitHub", url: "https://github.com/ZEROBYTE57" },
    { label: "LeetCode", url: "https://leetcode.com/u/VOIDSORROW/" },
    { label: "GeeksforGeeks", url: "https://www.geeksforgeeks.org/user/voidsorrow57/" },
    { label: "HackerRank", url: "https://www.hackerrank.com/profile/voidsorrow57" },
  ],
};
