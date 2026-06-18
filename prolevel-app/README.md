# Crazy With Tools

A professional AI-powered content editor and PDF generator built with Next.js, TypeScript, and Google Gemini API.

**Features:**
- ✨ Rich text editor with formatting toolbar
- 🤖 AI-powered content generation using Google Gemini API
- 📄 PDF export with jsPDF
- 🎨 Customizable UI with Tailwind CSS
- 📝 Add/Replace text operations
- 📌 Sticky notes for task management
- 📱 Fully responsive design
- 🔄 Content history tracking with MongoDB
- ⚡ Fast performance with Next.js 16 and Turbopack

## Stack

- **Frontend**: Next.js 16.2.9 + React 18.3 + TypeScript 5.6
- **Styling**: Tailwind CSS 3.4 + custom CSS
- **AI**: Google Gemini API (`@google/genai`)
- **Database**: MongoDB (optional for history sync)
- **PDF Export**: jsPDF + html2canvas
- **UI Components**: Lucide React icons
- **Deployment**: Vercel

## Setup

### Local Development

1. Clone and install:
```bash
npm install
cp .env.local.example .env.local
```

2. Configure `.env.local`:
```
NEXT_PUBLIC_MONGODB_URI=mongodb://your-connection-string
MONGODB_URI=mongodb://your-connection-string
NEXT_PUBLIC_GENAI_API_KEY=your-gemini-api-key
```

3. Run development server:
```bash
npm run dev
```

Visit `http://localhost:3000` for the home page or `http://localhost:3000/prolevel` for the Pro Level editor.

### Build

```bash
npm run build
npm start
```

## Vercel Deployment

This project is optimized for Vercel deployment:

1. **Environment Variables**: Set in Vercel dashboard:
   - `NEXT_PUBLIC_MONGODB_URI` - MongoDB connection string
   - `MONGODB_URI` - MongoDB connection string
   - `NEXT_PUBLIC_GENAI_API_KEY` - Google Gemini API key

2. **Deploy**:
   - Connect your GitHub repository to Vercel
   - Vercel will automatically detect Next.js and configure the build
   - Environment variables will be injected during build

3. **Configuration**: Uses `vercel.json` for Vercel-specific settings

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── generate/route.ts      - AI content generation
│   │   └── history/route.ts       - History management
│   ├── about/page.tsx             - About page
│   ├── customize/page.tsx         - UI customization
│   ├── privacy/page.tsx           - Privacy policy
│   ├── prolevel/page.tsx          - Pro Level editor
│   ├── page.tsx                   - Home page
│   └── layout.tsx                 - Root layout
├── components/
│   ├── MainEditor.tsx             - Rich text editor
│   ├── Sidebar.tsx                - Left navigation
│   ├── RightPanel.tsx             - Settings panel
│   ├── AIContentGenerator.tsx      - AI generation UI
│   ├── OutputSection.tsx          - Results display
│   ├── EmojiPicker.tsx            - Emoji selector
│   └── ...
├── lib/
│   ├── text-processor.ts          - Text operations
│   ├── mongodb.ts                 - DB connection
│   ├── session.ts                 - Session management
│   └── utils.ts                   - Helper utilities
└── types/
    └── index.ts                   - TypeScript definitions
```

## API Routes
