"use client";

import React, { useState } from "react";
import {
  Mail,
  Instagram,
  Linkedin,
  Copy,
  ExternalLink,
  Download,
  Code,
} from "lucide-react";

const CONTACTS = {
  email: {
    label: "Email",
    value: "rohitguptacodec@gmail.com",
    href: "mailto:rohitguptacodec@gmail.com",
  },
  instagram: {
    label: "Instagram",
    value: "@rohitguptacodec",
    href: "https://www.instagram.com/rohitguptacodec/",
  },
  linkedin: {
    label: "LinkedIn",
    value: "rohit-gupta-2b5a892bb",
    href: "https://www.linkedin.com/in/rohit-gupta-2b5a892bb",
  },
} as const;

const PROJECTS = [
  {
    title: "Crazy With Tools",
    description:
      "Professional content editor with AI-powered features using Gemini API. Generate, edit, and export content as PDF instantly. Customize UI and build your own workflows easily.",
    link: "https://crazy-work.netlify.app/",
    source: "#",
    tech: ["React", "Next.js", "Gemini API"],
    year: "2025",
  },
  {
    title: "XCrazy Editor",
    description:
      "Lightning-fast content editor with multiple powerful features. Customize your UI, use Gemini API for intelligent content generation, and export to PDF in seconds. Optimized for speed and ease of use.",
    link: "https://xcrazy.netlify.app/",
    source: "#",
    tech: ["Next.js", "TypeScript", "Gemini API"],
    year: "2026",
  },
] as const;

type ContactKey = keyof typeof CONTACTS;

export default function AboutPage() {
  const [selected, setSelected] = useState<ContactKey>("email");
  const [copyMsg, setCopyMsg] = useState("");

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("Copied");
      setTimeout(() => setCopyMsg(""), 1400);
    } catch {
      setCopyMsg("Copy failed");
      setTimeout(() => setCopyMsg(""), 1400);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-zinc-950 to-zinc-900 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <main className="md:col-span-2 space-y-8">
            <header className="rounded-2xl border border-white/6 bg-gradient-to-br from-white/3 to-white/6 p-8 shadow-lg backdrop-blur-sm">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="shrink-0">
                  <div className="h-36 w-36 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 p-1">
                    <div className="h-full w-full rounded-full bg-zinc-950 flex items-center justify-center text-3xl font-bold text-white">
                      RG
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest text-cyan-300">
                    Rohit Gupta
                  </p>
                  <h1 className="mt-2 text-3xl md:text-4xl font-extrabold text-white">
                    Full‑stack (MERN) Developer
                  </h1>
                  <p className="mt-3 text-slate-300 max-w-2xl">
                    I build polished, accessible, and scalable web applications
                    using React, Next.js and Node. I focus on fast UX,
                    maintainable architecture and measurable results.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href="/prolevel.html"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg shadow transition"
                    >
                      {" "}
                      <Download size={16} /> Resume
                    </a>
                    <a
                      href={CONTACTS.linkedin.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-lg shadow hover:bg-white/6 transition"
                    >
                      {" "}
                      <Linkedin size={16} /> LinkedIn
                    </a>
                    <a
                      href={CONTACTS.instagram.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-lg shadow hover:bg-white/6 transition"
                    >
                      {" "}
                      <Instagram size={16} /> Instagram
                    </a>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {[
                      "React",
                      "Next.js",
                      "TypeScript",
                      "Tailwind",
                      "Node",
                      "In-memory history",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 text-sm rounded-full text-slate-100"
                      >
                        {" "}
                        <Code size={14} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <section>
              <h2 className="text-xl font-bold text-white mb-4">
                Featured Projects
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {PROJECTS.map((project) => (
                  <article
                    key={project.title}
                    className="rounded-xl border border-white/6 p-5 bg-white/3 hover:scale-[1.02] transition shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {project.title}
                        </h3>
                        <p className="text-slate-300 text-sm mt-1">
                          {project.description}
                        </p>
                        <div className="mt-3 flex gap-3">
                          <a
                            href={project.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-cyan-300 underline flex items-center gap-2"
                          >
                            Live <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                      <div className="text-slate-400 text-sm flex flex-col items-end">
                        <span className="font-bold text-xs">
                          {project.tech[0]}
                        </span>
                        <span className="text-xs">{project.year}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <div className="rounded-xl border border-white/6 bg-white/3 p-4 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-cyan-300 uppercase tracking-widest">
                    Contact
                  </p>
                  <p className="font-semibold text-white">Get in touch</p>
                </div>
                <div className="text-slate-300 text-sm">Quick</div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => setSelected("email")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${selected === "email" ? "bg-white/6" : "bg-white/5"}`}
                >
                  <Mail /> <span className="text-sm">Email</span>
                </button>
                <button
                  onClick={() => setSelected("instagram")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${selected === "instagram" ? "bg-white/6" : "bg-white/5"}`}
                >
                  <Instagram /> <span className="text-sm">Instagram</span>
                </button>
                <button
                  onClick={() => setSelected("linkedin")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${selected === "linkedin" ? "bg-white/6" : "bg-white/5"}`}
                >
                  <Linkedin /> <span className="text-sm">LinkedIn</span>
                </button>
              </div>

              <div className="mt-3 bg-white/4 p-3 rounded-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="rounded-md bg-white/6 p-2 flex-shrink-0">
                    {selected === "email" && <Mail size={18} />}
                    {selected === "instagram" && <Instagram size={18} />}
                    {selected === "linkedin" && <Linkedin size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm">
                      {CONTACTS[selected].label}
                    </p>
                    <p className="text-slate-300 text-sm truncate">
                      {CONTACTS[selected].value}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
                  {selected === "email" ? (
                    <button
                      onClick={() => handleCopy(CONTACTS.email.value)}
                      className="px-3 py-2 rounded-lg bg-white/5 text-sm flex items-center gap-2"
                    >
                      {" "}
                      <Copy size={14} /> Copy
                    </button>
                  ) : (
                    <a
                      href={CONTACTS[selected].href}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-lg bg-white/5 text-sm flex items-center gap-2"
                    >
                      {" "}
                      <ExternalLink size={14} /> Open
                    </a>
                  )}
                  {copyMsg && (
                    <div className="text-sm text-green-400 ml-2">{copyMsg}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/6 bg-white/3 p-4">
              <p className="text-xs text-cyan-300 uppercase tracking-widest mb-3">
                Skills
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "React",
                  "Next.js",
                  "TypeScript",
                  "Tailwind",
                  "Node",
                  "In-memory history",
                  "Docker",
                ].map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1 rounded-full bg-white/5 text-sm text-slate-100"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/6 bg-white/3 p-4">
              <p className="text-xs text-cyan-300 uppercase tracking-widest mb-3">
                Experience
              </p>
              <ul className="text-sm text-slate-300 space-y-3">
                <li>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        Freelance Web Developer
                      </p>
                      <p className="text-xs text-slate-400">2022 — Present</p>
                    </div>
                    <div className="text-xs text-slate-400">Remote</div>
                  </div>
                </li>
                <li>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        B.Tech Student (MERN focus)
                      </p>
                      <p className="text-xs text-slate-400">2021 — 2025</p>
                    </div>
                    <div className="text-xs text-slate-400">Ayodhya, UP</div>
                  </div>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
