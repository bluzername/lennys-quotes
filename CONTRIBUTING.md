# Contributing to Lenny's Podcast Wisdom

First off, thank you for considering contributing! This project thrives on community input. Whether you're fixing a typo, adding a feature, or suggesting an idea — every contribution matters.

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/bluzername/lennys-quotes.git
cd lennys-quotes

# Install dependencies
npm install

# Download transcripts (runs automatically on install)
npm run download-transcripts

# Start development
npm run dev
```

---

## Ways to Contribute

### 🐛 Found a Bug?

1. Check [existing issues](https://github.com/bluzername/lennys-quotes/issues) first
2. If it's new, [open an issue](https://github.com/bluzername/lennys-quotes/issues/new) with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior

### 💡 Have an Idea?

Ideas for new tools, better search, or integrations are welcome! Open an issue tagged `enhancement` and describe:
- What problem it solves
- How you envision it working
- Any relevant examples

### 🔧 Want to Code?

#### Good First Issues

Look for issues labeled [`good first issue`](https://github.com/bluzername/lennys-quotes/labels/good%20first%20issue) — these are great starting points.

#### Feature Ideas We'd Love Help With

| Feature | Difficulty | Description |
|---------|------------|-------------|
| Quote of the Day | Easy | New tool returning a curated daily quote |
| Episode Tags | Medium | Categorize episodes (founder/VC/designer) |
| Semantic Search | Hard | Embedding-based search for better relevance |
| Share Cards | Medium | Generate shareable quote images |

#### Pull Request Process

1. **Fork** the repo and create a branch: `git checkout -b feature/your-feature`
2. **Make** your changes with clear, focused commits
3. **Test** locally with `npm run dev`
4. **Submit** a PR with:
   - Clear title (e.g., "Add: Quote of the Day tool")
   - Description of what changed and why
   - Screenshots/examples if applicable

---

## Code Style

- **TypeScript** — Strong typing preferred
- **Formatting** — Keep it readable, consistent with existing code
- **Comments** — Only where logic isn't self-evident
- **Naming** — Descriptive function/variable names over comments

---

## Project Structure

```
src/
├── index.ts          # MCP server setup and tool registration
├── data/
│   ├── loader.ts     # Transcript loading and parsing
│   ├── indexer.ts    # Lunr.js search index
│   └── types.ts      # TypeScript interfaces
└── utils/
    ├── quote-extractor.ts  # Format quotes for display
    ├── youtube.ts          # YouTube URL helpers
    └── smart-search.ts     # Multi-phase search logic
```

---

## Questions?

- Open a [Discussion](https://github.com/bluzername/lennys-quotes/discussions) for general questions
- Tag the maintainer in issues if you're stuck

---

**Thank you for helping make PM knowledge more accessible!** 🎙️
