'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import iconManifest from '../utils/icon-manifest.json'
import techIconManifest from '../utils/tech-icon-manifest.json'

export interface IconInfo {
    name: string
    path: string
    category?: string
    provider: string
    keywords?: string[]
}

interface LibraryPanelProps {
    isOpen: boolean
    onIconSelect: (iconPath: string, iconName?: string, iconKey?: string) => void
    activeSection: string | null
    theme: 'light' | 'dark'
    onClose?: () => void
    onSectionChange?: (section: string) => void
    title?: string
    dockLeft?: boolean
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
    isOpen,
    onIconSelect,
    activeSection,
    theme,
    onClose,
    onSectionChange,
    title = 'Draw Shape/Icon',
    dockLeft,
}) => {
    const [icons, setIcons] = useState<IconInfo[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Ref to track if the update came from internal scroll to prevent loop
    const isInternalScrollUpdate = useRef(false)

    // Load icons
    useEffect(() => {
        const loadIcons = () => {
            const allIcons: IconInfo[] = []
            if (iconManifest) {
                const manifest = iconManifest as { aws: IconInfo[]; azure: IconInfo[]; gcp: IconInfo[]; kubernetes: IconInfo[] }
                if (manifest.aws) allIcons.push(...manifest.aws)
                if (manifest.azure) allIcons.push(...manifest.azure)
                if (manifest.gcp) allIcons.push(...manifest.gcp)
                if (manifest.kubernetes) allIcons.push(...manifest.kubernetes)
            }
            // Load tech icons
            if (techIconManifest) {
                allIcons.push(...(techIconManifest as IconInfo[]))
            }
            setIcons(allIcons)
        }
        loadIcons()
    }, [])

    const groupedIcons = useMemo(() => {
        const groups: Record<string, Record<string, IconInfo[]>> = {
            Languages: {}, Frameworks: {}, Databases: {}, Os: {}, Tools: {},
            AWS: {}, Azure: {}, GCP: {}, Kubernetes: {}
        }
        
        icons.forEach(icon => {
            const validProviders = ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Languages', 'Frameworks', 'Databases', 'Os', 'Tools']
            if (validProviders.includes(icon.provider)) {
                const categoryKey = icon.provider === 'GCP' ? 'All Icons' : (icon.category || 'Other')
                if (!groups[icon.provider][categoryKey]) groups[icon.provider][categoryKey] = []
                groups[icon.provider][categoryKey].push(icon)
            }
        })
        return groups
    }, [icons])

    // Scroll to section when activeSection changes (PROGRAMMATIC SCROLL)
    useEffect(() => {
        // If the update came from our own scroll listener, DO NOT force scroll back
        if (isInternalScrollUpdate.current) {
            isInternalScrollUpdate.current = false
            return
        }

        if (activeSection && sectionRefs.current[activeSection] && scrollContainerRef.current) {            
            const sectionEl = sectionRefs.current[activeSection]
            const containerEl = scrollContainerRef.current
            
            // Calculate relative position within the scroll container
            const topOffset = Math.max(0, (sectionEl?.offsetTop ?? 0) - 94)
            
            // Manual scroll to avoid page jumping
            containerEl.scrollTo({
                top: topOffset,
                behavior: 'smooth'
            })
        }
    }, [activeSection, isOpen])



    // Handle Scroll Spy (USER SCROLL)
    const handleScroll = () => {
        if (!scrollContainerRef.current || !onSectionChange) return

        // ...Existing scroll spy logic...
        const container = scrollContainerRef.current
        const scrollTop = container.scrollTop
        const offset = 100 // Threshold to consider section active

        // Find the section that is closest to top (but not past viewport top + threshold)
        const sections = Object.entries(sectionRefs.current)

        let activeKey: string | null = null

        for (const [key, el] of sections) {
            if (!el) continue
            if (el.offsetTop <= scrollTop + offset) {
                activeKey = key
            } else {
                // Since sections are likely ordered by offsetTop, we can break early?
                // Not guaranteed if Object.entries order varies, but usually fine for insertion order
            }
        }

        if (activeKey && activeKey !== activeSection) {
            isInternalScrollUpdate.current = true
            onSectionChange(activeKey)
        }
    }

    // Filter logic
    const getFilteredIcons = (provider: string) => {
        const providerIcons = groupedIcons[provider]
        if (!providerIcons) return null

        const query = searchQuery.toLowerCase()
        if (!query) return providerIcons

        const filtered: Record<string, IconInfo[]> = {}
        Object.keys(providerIcons).forEach(cat => {
            const iconsInCat = providerIcons[cat].filter(icon => 
                icon.name.toLowerCase().includes(query) ||
                icon.category?.toLowerCase().includes(query) ||
                icon.keywords?.some(k => k.toLowerCase().includes(query))
            )
            if (iconsInCat.length > 0) {
                filtered[cat] = iconsInCat
            }
        })
        return Object.keys(filtered).length > 0 ? filtered : filtered
    }

    const renderSection = (title: string, providerKey: string) => {
        const filteredIcons = getFilteredIcons(providerKey)
        if (!filteredIcons) return null

        return (
            <div 
                ref={el => { sectionRefs.current[providerKey] = el }} 
                className="mb-6 scroll-mt-4"
            >
                <h3 className={`font-semibold text-sm mb-3 sticky top-0 py-2 z-10 ${
                    theme === 'dark' ? 'text-gray-200 bg-[#1A1A1F]/95' : 'text-gray-700 bg-white/95'
                }`}>
                    {title}
                </h3>
                
                <div className="space-y-4"> 
                    {Object.keys(filteredIcons).sort().map(cat => (
                        <div key={cat}>
                            <h4 className={`text-[10px] font-bold mb-2 uppercase tracking-wider ${
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                                {cat}
                            </h4>
                            <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
                                {filteredIcons[cat].map((icon, idx) => (
                                    <button
                                        key={idx}
                                        onPointerDown={() => onIconSelect(icon.path, icon.name, icon.path)}
                                        className={`group p-1.5 rounded-lg border aspect-square flex items-center justify-center transition-all hover:shadow-md ${
                                            theme === 'dark'
                                                ? 'bg-[#1A1A1F] border-gray-700 hover:bg-gray-700/50 hover:border-gray-500'
                                                : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-[#36C3AD]'
                                        }`}
                                        title={icon.name}
                                    >
                                        <div className="w-full h-full flex items-center justify-center p-1">
                                            <img
                                                src={icon.path}
                                                alt={icon.name}
                                                className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-200 group-hover:scale-110"
                                                loading="lazy"
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!isOpen) return null

    return (
        <div 
            className={`absolute top-20 rounded-2xl bottom-20 ${dockLeft ? 'left-12 ' : 'left-24 '} z-40 w-[80vw] md:w-80 shadow-2xl backdrop-blur-xl border transition-all duration-300 flex flex-col pointer-events-auto ${
                theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/95 border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
        >
            {/* Search Header */}
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h2 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {title}
                </h2>
                <div className={`flex items-center px-3 py-2.5 rounded-xl border focus-within:ring-2 focus-within:ring-[#36C3AD]/20 ${
                    theme === 'dark' ? 'bg-[#121216] border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 mr-2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search icons..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`bg-transparent border-none outline-none w-full text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}
                        autoFocus
                    />
                </div>
            </div>

            {/* Scrollable Content */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4"
                ref={scrollContainerRef}
                onScroll={handleScroll}
            >
                {renderSection('Languages', 'Languages')}
                {renderSection('Frameworks', 'Frameworks')}
                {renderSection('Databases', 'Databases')}
                {renderSection('Operating Systems', 'Os')}
                {renderSection('Tools', 'Tools')}
                
                <div className={`my-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`} />
                
                {renderSection('Amazon Web Services', 'AWS')}
                {renderSection('Microsoft Azure', 'Azure')}
                {renderSection('Google Cloud Platform', 'GCP')}
                {renderSection('Kubernetes', 'Kubernetes')}

                {/* Empty State */}
                {searchQuery && !getFilteredIcons('AWS') && !getFilteredIcons('Azure') && !getFilteredIcons('GCP') && 
                 !getFilteredIcons('Kubernetes') && !getFilteredIcons('Languages') && !getFilteredIcons('Frameworks') &&
                 !getFilteredIcons('Databases') && !getFilteredIcons('Os') && !getFilteredIcons('Tools') && (
                    <div className="text-center py-12 text-gray-400">
                        <p>No icons found for "{searchQuery}"</p>
                    </div>
                )}
            </div>
        </div>
    )
}
