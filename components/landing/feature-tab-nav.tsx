"use client"

import { motion } from "framer-motion"
import {
  Wand2, Palette, Shield, FileText, Zap,
  Sparkles, Globe, PenTool, Users, Calculator,
  Languages, Stamp, type LucideIcon,
} from "lucide-react"
import { useState } from "react"

// Icon lookup so server components can pass serializable string keys
const iconMap: Record<string, LucideIcon> = {
  Wand2, Palette, Shield, FileText, Zap,
  Sparkles, Globe, PenTool, Users, Calculator,
  Languages, Stamp,
}

export interface TabData {
  id: string
  label: string
  icon: string // key into iconMap
}

export interface TabFeature {
  icon: string // key into iconMap
  name: string
  detail: string
}

export interface TabContentData {
  title: string
  desc: string
  features: TabFeature[]
}

interface FeatureTabNavProps {
  tabs: TabData[]
  tabContent: Record<string, TabContentData>
}

export function FeatureTabNav({ tabs, tabContent }: FeatureTabNavProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "")
  const content = tabContent[activeTab]

  return (
    <>
      {/* Tab Navigation Pills */}
      <div className="inline-flex flex-wrap justify-center gap-2 p-2 rounded-full bg-white/80 backdrop-blur-sm border border-stone-200/50 shadow-lg">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.icon]
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-[var(--landing-dark)] text-white shadow-md"
                  : "text-[var(--landing-text-muted)] hover:text-[var(--landing-text-dark)] hover:bg-stone-100"
              }`}
            >
              {Icon && <Icon size={16} />}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content Panel */}
      {content && (
        <section className="py-20 px-6 sm:px-10">
          <div className="max-w-6xl mx-auto">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="text-center mb-16">
                <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
                  {content.title}
                </h2>
                <p className="text-lg text-[var(--landing-text-muted)] max-w-2xl mx-auto">
                  {content.desc}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {content.features.map((feat, i) => {
                  const FeatIcon = iconMap[feat.icon]
                  return (
                    <motion.div
                      key={feat.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="group p-8 rounded-[2rem] bg-white border border-stone-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center text-[var(--landing-amber)] mb-6 group-hover:scale-110 transition-transform">
                        {FeatIcon && <FeatIcon size={28} />}
                      </div>
                      <h3 className="font-display text-xl font-bold mb-2">
                        {feat.name}
                      </h3>
                      <p className="text-[var(--landing-text-muted)] leading-relaxed">
                        {feat.detail}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </>
  )
}
