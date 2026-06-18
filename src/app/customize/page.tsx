"use client";

import React, { useEffect, useState } from "react";
import { Save, Upload, RotateCcw, ArrowLeft, X } from "lucide-react";
import {
  BUTTON_BG_COLOR,
  BUTTON_TEXT_COLOR,
  THEME_COLOR,
  TEXT_COLOR,
  ACTIVE_COLOR,
} from "@/lib/utils";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "site_customization";

const DEFAULT_CUSTOMIZATION = {
  textColor: "#ffffff",
  activeColor: "#ffffff",
  themeColor: "#ffffff",
  // Default background image shipped with the site (from /public)
  backgroundImage: "/crazybgimage.png",
  buttonBgColor: "#10B981",
  buttonTextColor: "#000000",
  apiKey: "",
};

export default function CustomizePage() {
  const router = useRouter();
  const [localSettings, setLocalSettings] = useState<any>(
    DEFAULT_CUSTOMIZATION,
  );
  const [previewImage, setPreviewImage] = useState<string>(
    DEFAULT_CUSTOMIZATION.backgroundImage || "",
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloudName, setCloudName] = useState<string>("");
  const [uploadPreset, setUploadPreset] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLocalSettings({ ...DEFAULT_CUSTOMIZATION, ...parsed });
        setPreviewImage(
          parsed.backgroundImage || DEFAULT_CUSTOMIZATION.backgroundImage,
        );
        // apply saved customization immediately
        try {
          applyCustomization({ ...DEFAULT_CUSTOMIZATION, ...parsed });
        } catch (err) {}
      } catch {
        setLocalSettings(DEFAULT_CUSTOMIZATION);
      }
    }
  }, []);

  // Apply customization to :root CSS variables and body background
  const applyCustomization = (settings: any) => {
    if (typeof window === "undefined") return;
    try {
      const root = document.documentElement;
      root.style.setProperty(
        "--text-color",
        settings.textColor || DEFAULT_CUSTOMIZATION.textColor,
      );
      root.style.setProperty(
        "--active-color",
        settings.activeColor || DEFAULT_CUSTOMIZATION.activeColor,
      );
      root.style.setProperty(
        "--button-bg-color",
        settings.buttonBgColor || DEFAULT_CUSTOMIZATION.buttonBgColor,
      );
      root.style.setProperty(
        "--button-text-color",
        settings.buttonTextColor || DEFAULT_CUSTOMIZATION.buttonTextColor,
      );
      root.style.setProperty(
        "--theme-color",
        settings.themeColor || DEFAULT_CUSTOMIZATION.themeColor,
      );
      // also set a CSS var for bg-image and set body background for broad compatibility
      if (settings.backgroundImage) {
        root.style.setProperty(
          "--bg-image",
          `url(${settings.backgroundImage})`,
        );
        document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
      } else {
        root.style.removeProperty("--bg-image");
        document.body.style.backgroundImage = "";
      }
    } catch (e) {
      import("@/lib/logger")
        .then(({ error: logError }) =>
          logError("failed to apply customization", e),
        )
        .catch(() => {});
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If cloudinary config present, upload to Cloudinary unsigned endpoint
    if (cloudName && uploadPreset) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("upload_preset", uploadPreset);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: "POST",
            body: form,
          },
        );

        if (!res.ok) throw new Error("Cloudinary upload failed");
        const data = await res.json();
        const url = data.secure_url || data.url;
        if (url) {
          setPreviewImage(url);
          setLocalSettings((prev: any) => ({ ...prev, backgroundImage: url }));
          setSuccessMessage("Image uploaded to Cloudinary.");
          setTimeout(() => setSuccessMessage(null), 2000);
          // apply immediately
          try {
            applyCustomization({ ...localSettings, backgroundImage: url });
          } catch (err) {}
        }
      } catch (err: any) {
        try {
          const { error: logError } = await import("@/lib/logger");
          logError(err);
        } catch {}
        setError(err?.message || "Cloudinary upload failed.");
        setTimeout(() => setError(null), 4000);
      } finally {
        setUploading(false);
      }
      return;
    }

    // Fallback: client-side resize & compress to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 720;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        setPreviewImage(compressedBase64);
        setLocalSettings((prev: any) => ({
          ...prev,
          backgroundImage: compressedBase64,
        }));
        try {
          applyCustomization({
            ...localSettings,
            backgroundImage: compressedBase64,
          });
        } catch (err) {}
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    // Open confirmation modal instead of immediately resetting
    setShowResetConfirm(true);
  };

  const doReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setLocalSettings(DEFAULT_CUSTOMIZATION);
    setPreviewImage(DEFAULT_CUSTOMIZATION.backgroundImage);
    try {
      applyCustomization(DEFAULT_CUSTOMIZATION);
    } catch (e) {}
    setShowResetConfirm(false);
    setSuccessMessage("Settings reset to defaults.");
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto flex gap-6 items-start">
        {/* Left side panel removed (ads removed) */}

        {/* Main customize container */}
        <main className="w-full md:w-3/5 bg-black/900 backdrop-blur-xl border border-black/10 rounded-3xl p-6 md:p-10 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-bold uppercase tracking-widest text-xs">
                Back to Home
              </span>
            </button>
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              Customize Theme
            </h1>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-xs font-medium">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-medium">
              {successMessage}
            </div>
          )}

          <div className="space-y-8">
            <div
              className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 gap-3 md:gap-4"
              style={{ minHeight: 180 }}
            >
              <div className="space-y-2 md:space-y-3 md:col-start-1 md:row-start-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Active Color
                </label>
                <div className="flex items-center gap-3 p-1 md:p-3 bg-white/5 border border-white/10 rounded-2xl">
                  <input
                    type="color"
                    value={localSettings.activeColor}
                    onChange={(e) =>
                      setLocalSettings((p: any) => ({
                        ...p,
                        activeColor: e.target.value,
                      }))
                    }
                    className="w-8 h-8 md:w-8 md:h-8 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <span className="font-mono text-[10px] uppercase">
                    {localSettings.activeColor}
                  </span>
                </div>
              </div>

              <div className="space-y-2 md:space-y-3 md:col-start-3 md:row-start-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Button Text
                </label>
                <div className="flex items-center gap-3 p-1 md:p-3 bg-white/5 border border-white/10 rounded-2xl">
                  <input
                    type="color"
                    value={localSettings.buttonTextColor || "#000000"}
                    onChange={(e) =>
                      setLocalSettings((p: any) => ({
                        ...p,
                        buttonTextColor: e.target.value,
                      }))
                    }
                    className="w-8 h-8 md:w-8 md:h-8 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <span className="font-mono text-[10px] uppercase">
                    {localSettings.buttonTextColor}
                  </span>
                </div>
              </div>

              <div className="space-y-2 md:space-y-3 md:col-start-2 md:row-start-2 flex flex-col items-center">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  User Text Color
                </label>
                <div className="flex items-center gap-3 p-1 md:p-3 bg-white/5 border border-white/10 rounded-2xl">
                  <input
                    type="color"
                    value={localSettings.textColor || "#ffffff"}
                    onChange={(e) =>
                      setLocalSettings((p: any) => ({
                        ...p,
                        textColor: e.target.value,
                      }))
                    }
                    className="w-8 h-8 md:w-8 md:h-8 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <span className="font-mono text-[10px] uppercase">
                    {localSettings.textColor}
                  </span>
                </div>
              </div>

              <div className="space-y-2 md:space-y-3 md:col-start-1 md:row-start-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Theme Color
                </label>
                <div className="flex items-center gap-3 p-1 md:p-3 bg-white/5 border border-white/10 rounded-2xl">
                  <input
                    type="color"
                    value={localSettings.themeColor}
                    onChange={(e) =>
                      setLocalSettings((p: any) => ({
                        ...p,
                        themeColor: e.target.value,
                      }))
                    }
                    className="w-8 h-8 md:w-8 md:h-8 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <span className="font-mono text-[10px] uppercase">
                    {localSettings.themeColor}
                  </span>
                </div>
              </div>

              <div className="space-y-2 md:space-y-3 md:col-start-3 md:row-start-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Button Background
                </label>
                <div className="flex items-center gap-3 p-1 md:p-3 bg-white/5 border border-white/10 rounded-2xl">
                  <input
                    type="color"
                    value={localSettings.buttonBgColor || "#10B981"}
                    onChange={(e) =>
                      setLocalSettings((p: any) => ({
                        ...p,
                        buttonBgColor: e.target.value,
                      }))
                    }
                    className="w-8 h-8 md:w-8 md:h-8 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <span className="font-mono text-[10px] uppercase">
                    {localSettings.buttonBgColor}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="mt-6 p-6 rounded-3xl border border-white/10 bg-white/5"
              style={{ minHeight: 96 }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Content Generation API Key
                </p>
                <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                  Optional
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localSettings.apiKey}
                  onChange={(e) =>
                    setLocalSettings((p: any) => ({
                      ...p,
                      apiKey: e.target.value,
                    }))
                  }
                  placeholder="Enter your API key for content generation"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-all focus:border-cyan-300"
                />
                <a
                  href="https://aistudio.google.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-extrabold uppercase tracking-widest text-sky-400 transition"
                  title="Open API key settings"
                >
                  API Key
                </a>
              </div>
              <p className="mt-2 text-[10px] text-white/40">
                Save this key to enable AI content generation with your own API
                credentials. It will be stored locally in your browser.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                Background Image
              </label>
              <div className="relative group">
                <div
                  className="w-full h-48 rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center"
                  style={{
                    backgroundImage: `url(${previewImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {!previewImage && (
                    <span className="text-white/20 text-xs italic">
                      No image selected
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <label
                      className="cursor-pointer p-4 rounded-full hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: BUTTON_BG_COLOR,
                        color: BUTTON_TEXT_COLOR,
                      }}
                    >
                      <Upload size={20} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-white/40 italic text-center">
                  Click to upload a new background image
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                Live Preview
              </label>
              <div
                id="customize-preview"
                className="p-8 rounded-2xl border transition-all duration-500"
                style={
                  {
                    borderColor: localSettings.themeColor,
                    backgroundImage: `url(${previewImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundBlendMode: "overlay",
                    // expose CSS variables to nested elements for accurate preview
                    ["--theme-color" as any]: localSettings.themeColor,
                    ["--active-color" as any]: localSettings.activeColor,
                    ["--text-color" as any]: localSettings.textColor,
                    ["--button-bg-color" as any]: localSettings.buttonBgColor,
                    ["--button-text-color" as any]:
                      localSettings.buttonTextColor,
                    color: THEME_COLOR,
                  } as React.CSSProperties
                }
              >
                <h2
                  className="text-2xl font-black uppercase mb-4"
                  style={{ color: THEME_COLOR }}
                >
                  Sample Heading
                </h2>
                <p className="opacity-80 leading-relaxed">
                  This is how your website will look. The{" "}
                  <span style={{ color: ACTIVE_COLOR, fontWeight: "bold" }}>
                    Active Color
                  </span>{" "}
                  is used for highlights. The{" "}
                  <span style={{ color: THEME_COLOR, fontWeight: "bold" }}>
                    Theme Color
                  </span>{" "}
                  is used for UI elements. User-entered text
                  (inputs/contenteditable) will appear in{" "}
                  <span style={{ color: TEXT_COLOR, fontWeight: "bold" }}>
                    User Text Color
                  </span>
                  .
                </p>
                <div className="mt-4">
                  <button
                    style={{
                      backgroundColor: BUTTON_BG_COLOR,
                      color: BUTTON_TEXT_COLOR,
                    }}
                    className="px-4 py-2 rounded-lg font-bold"
                  >
                    Sample Button
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-6 border-t border-white/10">
              <button
                onClick={() => {
                  try {
                    localStorage.setItem(
                      STORAGE_KEY,
                      JSON.stringify(localSettings),
                    );
                    // apply immediately across the site
                    try {
                      applyCustomization(localSettings);
                    } catch (err) {}
                    setSuccessMessage("Settings saved successfully.");
                    setTimeout(() => {
                      setSuccessMessage(null);
                      router.push("/");
                    }, 900);
                  } catch (err: any) {
                    setError(err?.message || "Failed to save settings.");
                  }
                }}
                style={{
                  backgroundColor: BUTTON_BG_COLOR,
                  color: BUTTON_TEXT_COLOR,
                }}
                className="flex-1 py-1.5 md:py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
              >
                <Save size={18} />
                Save Changes
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="p-2 md:p-4 bg-white/10 border border-white/20 text-white/60 hover:text-white rounded-2xl transition-all"
                title="Reset to Defaults"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
        </main>

        {/* Reset confirmation modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowResetConfirm(false)}
            />
            <div className="relative bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg text-white shadow-2xl">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="absolute top-3 right-3 p-2 rounded-full hover:bg-white/5"
              >
                <X size={18} />
              </button>
              <h3 className="text-lg font-bold mb-2">Reset customizations?</h3>
              <p className="text-sm text-white/70 mb-6">
                This will remove all customized background images and colors and
                restore the site's defaults. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded-2xl bg-white/10 border border-white/20 text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={doReset}
                  style={{
                    backgroundColor: BUTTON_BG_COLOR,
                    color: BUTTON_TEXT_COLOR,
                  }}
                  className="px-4 py-2 rounded-2xl font-black"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right side panel removed (ads removed) */}
      </div>
    </div>
  );
}
