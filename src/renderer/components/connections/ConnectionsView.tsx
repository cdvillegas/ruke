import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useConnectionStore } from '../../stores/connectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useGrpcStore } from '../../stores/grpcStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useUiStore } from '../../stores/uiStore';
import { VariableHighlight } from '../shared/VariableInput';
import {
  Plug, Plus, Trash2, Globe, ChevronRight, ChevronDown,
  Search, Play, Upload, Loader2, Check, AlertCircle, Sparkles,
  FileJson, Send, Copy, ExternalLink, Shield, RefreshCw,
  Terminal, Code2, Braces, ChevronUp, Archive, ArchiveRestore,
  Zap, Database, Cloud, Server, Lock, Key, Cpu,
  Box, Layers, Radio, Wifi, Activity, Heart,
  Star, Bookmark, Flag, Bell, Mail, MessageSquare,
  ShoppingCart, CreditCard, Users, User, Map,
  Camera, Music, Film, Gamepad2, Rocket, Flame,
  Package, Headphones, Monitor, Smartphone, Tablet,
  Hash, AtSign, Link, Anchor, Compass, MapPin,
  Building2, Store, Home, Warehouse, TreePine, Mountain, Waves,
  Sun, Moon, Leaf, Flower2, Dog, Cat, Bird, Bug, Fish,
  Plane, Car, Ship, Bike, TrainFront,
  Coffee, Pizza, Apple, Cake, Utensils, Wine,
  Palette, Brush, Pencil, Wrench, Cog, SlidersHorizontal,
  Eye, Microscope, Telescope, Dumbbell, Timer, Hourglass, Calendar,
  Fingerprint, ShieldCheck, QrCode, Signal, Scan,
  Award, Trophy, Crown, Target, Gift, PartyPopper,
  Gem, Diamond, Coins, Wallet, BarChart3, TrendingUp,
  PieChart, LineChart, Gauge, Mic, Headset, Tv,
  Image, Aperture, FileCode2, GitBranch, GitMerge,
  Github, Container, Blocks, Puzzle, Component,
  LayoutGrid, LayoutDashboard, BookOpen, Library,
  GraduationCap, Lightbulb, Brain, Atom,
  Dna, Pill, HeartPulse, Stethoscope, Bone,
  Globe2, Earth, Orbit, Satellite, Space,
  Sparkle, Wand2, Ghost, Skull, Bot,
  HardDrive, CircuitBoard, Binary, Podcast,
  Navigation, LocateFixed, Receipt, PiggyBank,
  Scissors, Eraser, Printer, FolderOpen, FolderGit2,
  Table2, ListChecks, ClipboardList, FileText, Truck,
  Umbrella, AlarmClock, Popcorn, Clapperboard,
  Snowflake, Wind, Sprout, Squirrel,
  BadgeCheck, Medal, Siren,
  Rabbit, Turtle, Snail, Worm, PawPrint, Shell,
  Cherry, Grape, Banana, Carrot, Croissant, Sandwich,
  IceCreamCone, Cookie, Donut, Candy, CupSoda, Martini,
  Beer, Egg, EggFried, Ham, Drumstick, Beef,
  CakeSlice, ChefHat, CookingPot,
  Rat, Mouse, FishOff, Footprints,
  Lollipop, Dices, Swords, Drama,
  Smile, SmilePlus, Laugh, Meh, Frown, Angry,
  ThumbsUp, ThumbsDown, HandMetal, Handshake,
  HeartHandshake, HeartCrack,
  Baby, PersonStanding, Volleyball,
  Flower, Clover, TreeDeciduous, Trees, Palmtree, Shrub, Wheat,
  Rainbow, Sunrise, Sunset, Eclipse, MoonStar, Stars,
  Tornado, Droplet, Droplets, MountainSnow,
  CloudRain, CloudSnow, CloudLightning, CloudSun,
  FlameKindling, Tent, TentTree, TreePalm,
  Citrus, Salad, Soup, Milk, GlassWater, Nut,
  Stamp, Sticker,
  type LucideIcon,
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import Markdown from 'react-markdown';
import { METHOD_COLORS, VARIABLE_REGEX } from '@shared/constants';
import type { ApiConnection, ApiEndpoint, EndpointParam, DiscoveryResult, GrpcMethodType, AuthConfig } from '@shared/types';
import { AuthEditorCore, AUTH_TYPE_LABELS } from '../request/AuthEditor';
import yaml from 'js-yaml';

const ALL_ICONS: Record<string, LucideIcon> = {
  Dog, Cat, Bird, Fish, Bug, Rabbit, Turtle, Squirrel,
  Snail, Rat, Mouse, Worm, PawPrint, Shell, Bone, Footprints,

  Smile, SmilePlus, Laugh, Meh, Frown, Angry, Baby, PersonStanding,
  ThumbsUp, ThumbsDown, HandMetal, Handshake,
  Heart, HeartCrack, HeartHandshake, HeartPulse,

  Ghost, Skull, Swords, Dices, Gamepad2, Puzzle,
  Drama, Volleyball, Rocket, Flame, FlameKindling,
  Crown, Gem, Diamond, Trophy, Award, Medal, BadgeCheck,
  Star, Sparkle, Wand2, PartyPopper, Gift, Target,
  Lollipop, Candy, Popcorn, Sticker, Stamp,

  Sun, Moon, MoonStar, Stars, Eclipse, Rainbow,
  CloudSun, CloudRain, CloudSnow, CloudLightning,
  Sunrise, Sunset, Snowflake, Wind, Tornado,
  Droplet, Droplets, Waves, Mountain, MountainSnow,
  TreePine, TreeDeciduous, Trees, Palmtree, TreePalm, Shrub,
  Leaf, Flower, Flower2, Clover, Sprout, Wheat,

  Coffee, Pizza, Apple, Cherry, Grape, Banana, Citrus, Carrot, Nut,
  Cake, CakeSlice, Croissant, Sandwich, Cookie, Donut, IceCreamCone, Egg, EggFried,
  Utensils, Wine, Beer, Martini, CupSoda, Milk, GlassWater,
  Ham, Drumstick, Beef, Salad, Soup,
  ChefHat, CookingPot,

  Tent, TentTree, Compass, Anchor, MapPin, Map, Navigation,
  Plane, Car, Ship, Bike, TrainFront, Truck,
  Globe, Globe2, Earth, Umbrella,

  Zap, Database, Cloud, Server, Lock, Key, Cpu, Bot,
  Code2, Terminal, Braces, FileCode2, Container,
  GitBranch, GitMerge, Github, Blocks, Component,
  Monitor, Smartphone, Tablet, Tv,
  Link, AtSign, Hash, Wifi, Signal, Radio, QrCode,
  Satellite, Space, Orbit,
  HardDrive, CircuitBoard, Binary,

  ShoppingCart, CreditCard, Coins, Wallet, Store, Package, Warehouse,
  BarChart3, TrendingUp, PieChart, LineChart, Gauge, Receipt, PiggyBank,

  Mail, MessageSquare, Bell, Mic, Headset, Send, Podcast,
  Users, User, GraduationCap, Brain, Lightbulb,

  Palette, Brush, Pencil, Camera, Image, Aperture,
  Music, Film, Clapperboard, Headphones, Bookmark, Flag,

  Shield, ShieldCheck, Fingerprint, Eye, Scan, Siren,
  Dna, Atom, Pill, Stethoscope, Microscope, Telescope, Dumbbell, Activity,
  Wrench, Cog, SlidersHorizontal,

  Home, Building2, LayoutGrid, LayoutDashboard, Layers, Box,
  BookOpen, Library, FolderOpen, Plug,
  Hourglass, Timer, Calendar, AlarmClock,
};

const ICON_PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#64748b', '#78716c', '#a3a3a3', '#ffffff',
];

export function ConnectionIcon({ conn, size = 'md', className = '' }: {
  conn: ApiConnection;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = { xs: 'w-2 h-2', sm: 'w-7 h-7', md: 'w-10 h-10', lg: 'w-12 h-12' }[size];
  const textSize = { xs: 'text-[6px]', sm: 'text-[10px]', md: 'text-sm', lg: 'text-lg' }[size];
  const iconSize = { xs: 6, sm: 10, md: 16, lg: 20 }[size];
  const rounding = { xs: 'rounded-full', sm: 'rounded-md', md: 'rounded-xl', lg: 'rounded-2xl' }[size];

  if (size === 'xs') {
    return <div className={`${dims} ${rounding} ${className}`} style={{ background: conn.iconColor }} />;
  }

  const IconComp = conn.iconName ? ALL_ICONS[conn.iconName] : null;
  const letter = conn.iconLetter || conn.name.charAt(0).toUpperCase();

  return (
    <div
      className={`${dims} ${rounding} flex items-center justify-center shrink-0 text-white font-bold shadow-sm ${className}`}
      style={{ background: conn.iconColor }}
    >
      {IconComp ? <IconComp size={iconSize} strokeWidth={2.5} /> : <span className={textSize}>{letter}</span>}
    </div>
  );
}

function IconCustomizer({ conn }: { conn: ApiConnection }) {
  const { updateConnection } = useConnectionStore();
  const [iconSearch, setIconSearch] = useState('');
  const [symbolMode, setSymbolMode] = useState<'icon' | 'letter'>(conn.iconName ? 'icon' : 'letter');
  const [letterInput, setLetterInput] = useState(conn.iconLetter || conn.name.charAt(0).toUpperCase());

  const applyIcon = (name: string) => {
    updateConnection(conn.id, { iconName: name, iconLetter: undefined });
    setSymbolMode('icon');
  };

  const applyLetter = (letter: string) => {
    if (!letter.trim()) return;
    const val = letter.trim().slice(0, 2).toUpperCase();
    setLetterInput(val);
    updateConnection(conn.id, { iconName: undefined, iconLetter: val });
  };

  const visibleIcons = useMemo(() => {
    const entries = Object.entries(ALL_ICONS);
    if (!iconSearch.trim()) return entries;
    const q = iconSearch.toLowerCase();
    return entries.filter(([name]) => name.toLowerCase().includes(q));
  }, [iconSearch]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="group relative" title="Customize icon">
          <ConnectionIcon conn={conn} size="md" />
          <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Pencil size={14} className="text-white" />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50 w-[280px] rounded-2xl bg-bg-secondary border border-border shadow-xl p-4 animate-fade-in"
        >
          {/* Color */}
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Color</p>
          <div className="grid grid-cols-8 gap-1.5 mb-4">
            {ICON_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => updateConnection(conn.id, { iconColor: color })}
                className={`w-7 h-7 rounded-lg transition-all ${
                  conn.iconColor === color ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-secondary scale-110' : 'hover:scale-110'
                } ${color === '#ffffff' ? 'border border-border' : ''}`}
                style={{ background: color }}
              />
            ))}
          </div>

          {/* Symbol — toggle between Icon and Letter */}
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Symbol</p>
            <div className="flex rounded-md bg-bg-tertiary p-0.5 ml-auto">
              <button
                onClick={() => setSymbolMode('icon')}
                className={`px-2.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  symbolMode === 'icon' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Icon
              </button>
              <button
                onClick={() => setSymbolMode('letter')}
                className={`px-2.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  symbolMode === 'letter' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Letter
              </button>
            </div>
          </div>

          {symbolMode === 'icon' ? (
            <>
              <div className="relative mb-2">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Search icons..."
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="h-[168px] overflow-y-auto rounded-lg">
                <div className="grid grid-cols-8 gap-1.5">
                  {visibleIcons.map(([name, Icon]) => (
                    <button
                      key={name}
                      onClick={() => applyIcon(name)}
                      title={name}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        conn.iconName === name
                          ? 'bg-accent text-white'
                          : 'bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      <Icon size={13} />
                    </button>
                  ))}
                </div>
                {visibleIcons.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[10px] text-text-muted">No icons match "{iconSearch}"</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex flex-col gap-2">
              <input
                type="text"
                maxLength={2}
                value={letterInput}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setLetterInput(val);
                  if (val.trim()) applyLetter(val);
                }}
                placeholder={conn.name.charAt(0).toUpperCase()}
                className="w-full py-1.5 text-center text-sm font-bold rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <p className="text-[10px] text-text-muted mb-1">Type 1–2 characters, or pick one:</p>
              <div className="flex-1 overflow-y-auto rounded-lg">
                <div className="grid grid-cols-8 gap-1.5">
                  {'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@&!?+$%'.split('').map((ch) => (
                    <button
                      key={ch}
                      onClick={() => applyLetter(ch)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all ${
                        !conn.iconName && (conn.iconLetter || conn.name.charAt(0).toUpperCase()) === ch
                          ? 'bg-accent text-white'
                          : 'bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const SPEC_SUFFIXES = [
  '/openapi.json', '/openapi.yaml', '/swagger.json',
  '/swagger/v1/swagger.json', '/api-docs',
  '/v1/openapi.json', '/v2/openapi.json', '/docs/openapi.json',
];

function parseSpec(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  return yaml.load(trimmed);
}

function isUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

function isSpecContent(s: string): boolean {
  const t = s.trim();
  return t.startsWith('{') || t.startsWith('[') || /^(openapi|swagger)\s*:/m.test(t);
}

function isSpecUrl(s: string): boolean {
  const lower = s.toLowerCase();
  return lower.includes('swagger') || lower.includes('openapi') || lower.includes('api-docs') ||
    lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml');
}

async function tryProbeSpec(baseUrl: string): Promise<{ spec: any; url: string } | null> {
  const base = baseUrl.replace(/\/+$/, '');
  for (const suffix of SPEC_SUFFIXES) {
    try {
      const url = base + suffix;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const text = await res.text();
      const spec = parseSpec(text);
      if (spec?.openapi || spec?.swagger || spec?.paths) return { spec, url };
    } catch {}
  }
  return null;
}

const CONNECTION_PLACEHOLDERS = [
  'https://api.example.com',
  'Drop an openapi.yaml file...',
  'Stripe',
  'Paste a Swagger spec URL...',
  'I\'m using the GitHub API',
  'https://petstore.swagger.io/v2/swagger.json',
  'Connect the OpenAI API',
];

type Phase = 'entering' | 'visible' | 'exiting';

function useWavePlaceholder(items: string[], displayMs = 3200) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('entering');
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };

  useEffect(() => {
    clearTimeouts();
    const text = items[index];
    const enterDuration = Math.min(text.length * 30, 600);

    if (phase === 'entering') {
      timeouts.current.push(setTimeout(() => setPhase('visible'), enterDuration + 100));
    } else if (phase === 'visible') {
      timeouts.current.push(setTimeout(() => setPhase('exiting'), displayMs));
    } else if (phase === 'exiting') {
      timeouts.current.push(setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setPhase('entering');
      }, 350));
    }
    return clearTimeouts;
  }, [index, phase, items, displayMs]);

  return { text: items[index], phase };
}

function WavePlaceholder({ text, phase }: { text: string; phase: Phase }) {
  const chars = useMemo(() => text.split(''), [text]);
  return (
    <span className="absolute left-11 text-sm pointer-events-none select-none flex z-[2]" aria-hidden>
      {chars.map((char, i) => (
        <span
          key={`${text}-${i}`}
          className={phase === 'exiting' ? 'placeholder-char-exit' : 'placeholder-char-enter'}
          style={{
            animationDelay: phase === 'exiting' ? `${i * 12}ms` : `${i * 25}ms`,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre',
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

type ResolveStatus = 'idle' | 'resolving' | 'resolved' | 'error';

interface ResolveStep {
  text: string;
  status: 'active' | 'done' | 'failed';
}

interface ResolveResult {
  name: string;
  description?: string;
  baseUrl: string;
  specUrl?: string;
  endpointCount: number;
  specType: 'openapi' | 'graphql' | 'grpc' | 'manual';
  specText?: string;
  endpoints?: ApiEndpoint[];
  discoveryResults?: DiscoveryResult[];
}

function ArchivedConnectionItem({ conn, isActive }: { conn: ApiConnection; isActive: boolean }) {
  const { unarchiveConnection, deleteConnection, setActiveConnection } = useConnectionStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div className="relative">
      <button
        onClick={() => setActiveConnection(conn.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left group ${
          isActive ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <ConnectionIcon conn={conn} size="sm" className="opacity-50" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate opacity-60">{conn.name}</p>
          <p className="text-[9px] text-text-muted font-mono truncate opacity-50">{conn.baseUrl}</p>
        </div>
        <div className="relative" ref={menuRef}>
          <span
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-active text-text-muted transition-all cursor-pointer"
          >
            <ChevronDown size={12} />
          </span>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              <button
                onClick={(e) => { e.stopPropagation(); unarchiveConnection(conn.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <ArchiveRestore size={12} /> Restore
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} /> Delete permanently
              </button>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

export function ConnectionsSidebar() {
  const { connections, archivedConnections, activeConnectionId, setActiveConnection, searchQuery, setSearchQuery, reorderConnections } = useConnectionStore();
  const aiCreatedItems = useUiStore(s => s.aiCreatedItems);
  const clearAiCreated = useUiStore(s => s.clearAiCreated);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);

  const isSearching = !!searchQuery.trim();

  const filtered = useMemo(() =>
    connections.filter(c =>
      !isSearching ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.baseUrl.toLowerCase().includes(searchQuery.toLowerCase())
    ), [connections, searchQuery, isSearching]);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    if (!draggedId || draggedId === targetId || isSearching) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropTarget({ id: targetId, position: e.clientY < midY ? 'above' : 'below' });
  }, [draggedId, isSearching]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId || !dropTarget || isSearching) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }
    const ordered = connections.map((c) => c.id);
    const fromIdx = ordered.indexOf(draggedId);
    if (fromIdx < 0) { setDraggedId(null); setDropTarget(null); return; }
    ordered.splice(fromIdx, 1);
    const toIdx = ordered.indexOf(dropTarget.id);
    ordered.splice(dropTarget.position === 'above' ? toIdx : toIdx + 1, 0, draggedId);
    reorderConnections(ordered);
    setDraggedId(null);
    setDropTarget(null);
  }, [draggedId, dropTarget, connections, reorderConnections, isSearching]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTarget(null);
  }, []);

  return (
    <>
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">APIs</h2>
          <button
            onClick={() => setActiveConnection(null)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search APIs..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {filtered.map((conn) => (
          <div
            key={conn.id}
            className={`relative ${draggedId === conn.id ? 'opacity-30' : ''}`}
            onDragOver={(e) => handleDragOver(e, conn.id)}
            onDragLeave={(e) => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                setDropTarget((prev) => prev?.id === conn.id ? null : prev);
              }
            }}
            onDrop={handleDrop}
          >
            {dropTarget?.id === conn.id && dropTarget.position === 'above' && (
              <div className="absolute top-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
            )}
            <button
              onClick={() => { if (aiCreatedItems.includes(conn.id)) clearAiCreated(conn.id); setActiveConnection(conn.id); }}
              draggable={!isSearching}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/ruke-context', JSON.stringify({ type: 'connection', id: conn.id, label: conn.name, meta: conn.baseUrl })); setDraggedId(conn.id); }}
              onDragEnd={handleDragEnd}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left group ${
                conn.id === activeConnectionId
                  ? 'bg-accent/10 text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              {aiCreatedItems.includes(conn.id) && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_4px_rgba(59,130,246,0.6)] animate-pulse shrink-0" />
              )}
              <ConnectionIcon conn={conn} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{conn.name}</p>
                <p className="text-[9px] text-text-muted font-mono truncate">{conn.baseUrl}</p>
              </div>
              <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {conn.endpoints.length}
              </span>
            </button>
            {dropTarget?.id === conn.id && dropTarget.position === 'below' && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
            )}
          </div>
        ))}

        {connections.length === 0 && archivedConnections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Plug size={20} className="text-text-muted mb-2" />
            <p className="text-xs text-text-muted">No APIs connected</p>
          </div>
        )}

        {archivedConnections.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/60">
            <button
              onClick={() => setArchiveExpanded(!archiveExpanded)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
            >
              {archiveExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <Archive size={10} />
              Archive ({archivedConnections.length})
            </button>
            {archiveExpanded && (
              <div className="space-y-0.5 mt-1">
                {archivedConnections.map(conn => (
                  <ArchivedConnectionItem key={conn.id} conn={conn} isActive={conn.id === activeConnectionId} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function ConnectionsMain() {
  const { connections, archivedConnections, activeConnectionId, archiveConnection, searchQuery, setSearchQuery } = useConnectionStore();
  const activeConn = [...connections, ...archivedConnections].find(c => c.id === activeConnectionId);
  const isArchived = archivedConnections.some(c => c.id === activeConnectionId);

  const handleRunEndpoint = useCallback(async (conn: ApiConnection, endpoint: ApiEndpoint) => {
    if (conn.specType === 'grpc') {
      const parts = endpoint.path.split('/');
      const methodName = parts.pop() || '';
      const serviceName = parts.join('/');
      const proto = conn.protoDefinition;
      const service = proto?.services.find(s => s.name === serviceName);
      const method = service?.methods.find(m => m.name === methodName);

      const grpcStore = useGrpcStore.getState();
      grpcStore.updateActiveRequest({
        serverUrl: conn.baseUrl,
        protoFilePath: proto?.filePath || '',
        serviceName: service?.fullName || serviceName,
        methodName,
        methodType: method?.methodType || 'unary',
        name: endpoint.summary || `${serviceName}.${methodName}`,
        message: '{}',
        metadata: [{ key: '', value: '', enabled: true }],
      });

      if (proto) {
        grpcStore.setProtoForRequest(proto.filePath, proto);
      }

      useUiStore.getState().setActiveProtocol('grpc');
      useUiStore.getState().setActiveView('requests');
      return;
    }

    const store = useRequestStore.getState();
    const now = new Date().toISOString();
    const id = nanoid();

    if (conn.specType === 'graphql') {
      const req = {
        id,
        collectionId: null,
        method: 'POST' as const,
        url: conn.baseUrl,
        name: endpoint.summary || endpoint.path,
        connectionId: conn.id,
        endpointId: endpoint.id,
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        params: [] as { key: string; value: string; enabled: boolean }[],
        body: {
          type: 'graphql' as const,
          graphql: {
            query: `{\n  ${endpoint.path} {\n    \n  }\n}`,
            variables: '{}',
          },
        },
        auth: conn.auth,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
      store.openTab(req);
      useUiStore.getState().setActiveProtocol('graphql');
      try { await window.ruke.db.query('createRequest', req); } catch {}
    } else {
      let body: any = { type: 'none' };
      if (endpoint.requestBody) {
        if (endpoint.requestBody.example) {
          body = { type: endpoint.requestBody.type, raw: endpoint.requestBody.example };
        } else {
          const bodyParams = (endpoint.parameters || []).filter(p => p.in === 'body');
          if (bodyParams.length > 0) {
            const template: Record<string, any> = {};
            for (const bp of bodyParams) {
              if (!bp.required) continue;
              if (bp.type === 'integer' || bp.type === 'number') template[bp.name] = 0;
              else if (bp.type === 'boolean') template[bp.name] = false;
              else if (bp.type.endsWith('[]')) template[bp.name] = [];
              else if (bp.type === 'object') template[bp.name] = {};
              else template[bp.name] = '';
            }
            body = { type: 'json', raw: JSON.stringify(template, null, 2) };
          } else if (endpoint.requestBody.schema && !endpoint.requestBody.schema.includes('$ref')) {
            body = { type: endpoint.requestBody.type, raw: endpoint.requestBody.schema };
          } else {
            body = { type: 'json', raw: '{}' };
          }
        }
      }

      const req = {
        id,
        collectionId: null,
        method: endpoint.method,
        url: endpoint.path,
        connectionId: conn.id,
        endpointId: endpoint.id,
        name: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
        headers: [{ key: '', value: '', enabled: true }],
        params: (endpoint.parameters || [])
          .filter(p => p.in === 'query' || p.in === 'path')
          .map(p => ({ key: p.name, value: '', enabled: p.in === 'path' || !!p.required })),
        body,
        auth: conn.auth,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
      store.openTab(req);
      useUiStore.getState().setActiveProtocol('rest');
      try { await window.ruke.db.query('createRequest', req); } catch {}
    }

    store.loadUncollectedRequests();
    useUiStore.getState().setActiveView('requests');
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      {activeConn ? (
        <ConnectionDetail
          conn={activeConn}
          isArchived={isArchived}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRunEndpoint={handleRunEndpoint}
          onArchive={() => archiveConnection(activeConn.id)}
        />
      ) : (
        <SmartAddPanel />
      )}
    </div>
  );
}

export function ConnectionsView() {
  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-64 h-full border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <ConnectionsSidebar />
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConnectionsMain />
      </div>
    </div>
  );
}

export interface QuickExample {
  label: string;
  desc: string;
  type: 'openapi' | 'graphql' | 'grpc';
  url: string;
  icon: typeof Globe;
  color: string;
}

export function SpecInput({ onConnected, quickExamples, className }: {
  onConnected?: (name: string, count: number, type: 'openapi' | 'graphql' | 'grpc') => void;
  quickExamples?: QuickExample[];
  className?: string;
} = {}) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ResolveStatus>('idle');
  const [steps, setSteps] = useState<ResolveStep[]>([]);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const [showGrpcSetup, setShowGrpcSetup] = useState(false);
  const [grpcServerUrl, setGrpcServerUrl] = useState('');
  const [grpcProtoPath, setGrpcProtoPath] = useState('');
  const [grpcName, setGrpcName] = useState('');
  const [grpcLoading, setGrpcLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const { importOpenApiSpec, importGraphQLEndpoint, importGrpcProto, addConnection, setActiveConnection } = useConnectionStore();
  const placeholder = useWavePlaceholder(CONNECTION_PLACEHOLDERS);

  const addStep = (text: string) => {
    setSteps(prev => {
      const updated = prev.map(s => s.status === 'active' ? { ...s, status: 'done' as const } : s);
      return [...updated, { text, status: 'active' }];
    });
  };

  const failActiveStep = () => {
    setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'failed' as const } : s));
  };

  const completeActiveStep = () => {
    setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'done' as const } : s));
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const reset = () => {
    setStatus('idle');
    setSteps([]);
    setResult(null);
    setError('');
    setShowManual(false);
  };

  const resolveSpecText = (text: string, sourceUrl?: string) => {
    try {
      const conn = importOpenApiSpec(text, sourceUrl);
      if (conn) {
        setResult({
          name: conn.name,
          description: conn.description,
          baseUrl: conn.baseUrl,
          specUrl: sourceUrl,
          endpointCount: conn.endpoints.length,
          specType: 'openapi',
        });
        setStatus('resolved');
        return true;
      }
    } catch {}
    return false;
  };

  const tryFetchSpec = async (specUrl: string): Promise<boolean> => {
    try {
      addStep(`Fetching spec from ${new URL(specUrl).hostname}...`);
      const res = await fetch(specUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { failActiveStep(); return false; }
      const text = await res.text();
      if (resolveSpecText(text, specUrl)) {
        completeActiveStep();
        return true;
      }
      failActiveStep();
    } catch {
      failActiveStep();
    }
    return false;
  };

  const handleDiscoveryResults = async (results: DiscoveryResult[], fallbackUrl?: string): Promise<boolean> => {
    const valid = results.filter(r => !r.error);
    if (valid.length === 0) return false;

    completeActiveStep();

    // If the backend already resolved endpoints, use them directly
    const withEndpoints = valid.filter(r => r.endpointCount > 0 && r.endpoints.length > 0);
    if (withEndpoints.length > 0) {
      const best = withEndpoints[0];
      setResult({
        name: best.name,
        description: best.description,
        baseUrl: best.baseUrl,
        specUrl: best.specUrl,
        endpointCount: best.endpointCount,
        specType: best.specType,
        endpoints: best.endpoints,
        discoveryResults: withEndpoints.length > 1 ? withEndpoints : undefined,
      });
      setStatus('resolved');
      return true;
    }

    // Try fetching spec from renderer as fallback
    for (const r of valid) {
      if (r.specUrl) {
        const fetched = await tryFetchSpec(r.specUrl);
        if (fetched) return true;
      }
    }

    setResult({
      name: valid[0].name,
      description: valid[0].description,
      baseUrl: valid[0].baseUrl || fallbackUrl || '',
      specType: 'manual',
      endpointCount: 0,
      discoveryResults: valid.length > 1 ? valid : undefined,
    });
    setStatus('resolved');
    return true;
  };

  const resolveInput = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    reset();
    setStatus('resolving');

    if (isSpecContent(trimmed)) {
      addStep('Parsing spec...');
      await new Promise(r => setTimeout(r, 100));
      if (resolveSpecText(trimmed)) {
        completeActiveStep();
        return;
      }
      failActiveStep();
      setStatus('error');
      setError('Could not parse spec. Check the format and try again.');
      return;
    }

    if (isUrl(trimmed)) {
      let hostname: string;
      try { hostname = new URL(trimmed).hostname.replace(/^www\./, ''); } catch { hostname = trimmed; }

      if (isSpecUrl(trimmed)) {
        addStep(`Fetching spec from ${hostname}...`);
        try {
          const res = await fetch(trimmed, { signal: AbortSignal.timeout(10000) });
          const text = await res.text();
          if (resolveSpecText(text, trimmed)) {
            completeActiveStep();
            return;
          }
        } catch {}
        failActiveStep();
      }

      addStep(`Checking ${hostname} for API documentation...`);
      const probed = await tryProbeSpec(trimmed);
      if (probed) {
        if (resolveSpecText(JSON.stringify(probed.spec), probed.url)) {
          completeActiveStep();
          return;
        }
      }
      failActiveStep();

      addStep(`Looking up known APIs for ${hostname}...`);
      try {
        const results: DiscoveryResult[] = await window.ruke.agent.discover(
          `Find the API for ${hostname}. The website is ${trimmed}`
        );
        if (await handleDiscoveryResults(results, trimmed)) return;
      } catch {}
      failActiveStep();

      addStep(`Searching the web for ${hostname} API spec...`);
      await new Promise(r => setTimeout(r, 800));
      try {
        const results: DiscoveryResult[] = await window.ruke.agent.discover(
          `Find the OpenAPI or Swagger spec URL for ${hostname}. Look for their developer documentation or API reference. The main website is ${trimmed}`
        );
        if (await handleDiscoveryResults(results, trimmed)) return;
      } catch {}
      failActiveStep();

      setManualUrl(trimmed);
      setManualName(hostname.replace(/^api\./, ''));
      setShowManual(true);
      setStatus('error');
      setError(`Could not find an API spec for ${hostname}. You can add it manually.`);
      return;
    }

    addStep(`Looking up ${trimmed}...`);
    try {
      const results: DiscoveryResult[] = await window.ruke.agent.discover(trimmed);
      if (await handleDiscoveryResults(results)) return;
      failActiveStep();
    } catch {
      failActiveStep();
    }

    setShowManual(true);
    setStatus('error');
    setError(`Could not find the ${trimmed} API. Try pasting a spec URL or adding manually.`);
  }, [importOpenApiSpec, addConnection, setActiveConnection]);

  const handleSubmit = () => {
    if (status === 'resolving') return;
    resolveInput(input);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text && isSpecContent(text) && text.length > 200) {
      e.preventDefault();
      setInput(text.slice(0, 100) + '...');
      resolveInput(text);
    }
  };

  const handleFileContent = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'proto') {
      reset();
      setShowGrpcSetup(true);
      setGrpcProtoPath(file.name);
      setGrpcName(file.name.replace(/\.proto$/, ''));
      return;
    }

    reset();
    setStatus('resolving');
    addStep(`Reading ${file.name}...`);
    try {
      const text = await file.text();
      if (resolveSpecText(text, file.name)) { completeActiveStep(); return; }
      setStatus('error');
      setError(`Could not parse ${file.name}. Make sure it's a valid OpenAPI/Swagger spec.`);
    } catch {
      setStatus('error');
      setError(`Failed to read ${file.name}.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileContent(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  };

  const handleBrowseFile = async () => {
    const result = await window.ruke.file.import([
      { name: 'API Specs', extensions: ['json', 'yaml', 'yml', 'graphql', 'gql', 'proto'] },
    ]);
    if (!result?.success) return;

    const ext = (result.path || '').split('.').pop()?.toLowerCase();
    if (ext === 'proto' && result.path) {
      reset();
      setShowGrpcSetup(true);
      setGrpcProtoPath(result.path);
      setGrpcName(result.path.split('/').pop()?.replace('.proto', '') || '');
      return;
    }

    if (result.content) {
      reset();
      setStatus('resolving');
      addStep('Parsing spec...');
      if (resolveSpecText(result.content, result.path)) { completeActiveStep(); return; }
      setStatus('error');
      setError('Could not parse the file. Make sure it\'s a valid OpenAPI/Swagger spec.');
    }
  };

  const selectLatest = () => {
    const conns = useConnectionStore.getState().connections;
    if (conns.length > 0) setActiveConnection(conns[conns.length - 1].id);
  };

  const notifyConnected = (name: string, endpointCt: number, specType: string) => {
    onConnected?.(name, endpointCt, specType === 'graphql' ? 'graphql' : 'openapi');
  };

  const handleConnect = (r: ResolveResult) => {
    // If we have endpoints from discovery results (multi-result picker)
    if (r.discoveryResults && r.discoveryResults.length > 0) {
      const match = r.discoveryResults.find(d => d.name === r.name);
      if (match && match.endpoints.length > 0) {
        const conn = addConnection({
          name: match.name,
          baseUrl: match.baseUrl,
          specUrl: match.specUrl,
          specType: match.specType,
          description: match.description,
          endpoints: match.endpoints,
        });
        setActiveConnection(conn.id);
        notifyConnected(match.name, match.endpoints.length, match.specType);
        return;
      }
    }

    // If we have endpoints carried through from discovery
    if (r.endpoints && r.endpoints.length > 0) {
      const conn = addConnection({
        name: r.name,
        baseUrl: r.baseUrl,
        specUrl: r.specUrl,
        specType: r.specType === 'manual' ? 'openapi' : r.specType,
        description: r.description,
        endpoints: r.endpoints,
      });
      setActiveConnection(conn.id);
      notifyConnected(r.name, r.endpoints.length, r.specType);
      return;
    }

    // Spec was already imported via resolveSpecText (connection already exists)
    if (r.endpointCount > 0) {
      selectLatest();
      notifyConnected(r.name, r.endpointCount, r.specType);
      return;
    }

    // Manual / no-endpoints connection
    const conn = addConnection({
      name: r.name,
      baseUrl: r.baseUrl,
      specUrl: r.specUrl,
      specType: r.specType === 'manual' ? 'manual' : r.specType,
      description: r.description,
    });
    setActiveConnection(conn.id);
    notifyConnected(r.name, 0, r.specType);
  };

  const handleManualSubmit = () => {
    if (!manualName.trim() || !manualUrl.trim()) return;
    const conn = addConnection({ name: manualName.trim(), baseUrl: manualUrl.trim(), specType: 'manual' });
    setActiveConnection(conn.id);
    notifyConnected(manualName.trim(), 0, 'manual');
  };

  const handleGrpcConnect = async () => {
    if (!grpcServerUrl.trim() || !grpcProtoPath) return;
    setGrpcLoading(true);
    try {
      const conn = await importGrpcProto(grpcServerUrl.trim(), grpcProtoPath, grpcName.trim() || undefined);
      if (conn) {
        setActiveConnection(conn.id);
        onConnected?.(conn.name, conn.endpoints.length, 'openapi');
        setShowGrpcSetup(false);
      }
    } catch (e) {
      console.error('gRPC import failed:', e);
    }
    setGrpcLoading(false);
  };

  const handleQuickExample = async (example: QuickExample) => {
    setLoadingExample(example.url);
    try {
      if (example.type === 'graphql') {
        const conn = await importGraphQLEndpoint(example.url, example.label);
        if (conn) {
          setActiveConnection(conn.id);
          notifyConnected(conn.name, conn.endpoints.length, 'graphql');
        }
      } else {
        reset();
        setStatus('resolving');
        addStep(`Fetching ${example.label}...`);
        const res = await fetch(example.url);
        const text = await res.text();
        if (resolveSpecText(text, example.url)) {
          completeActiveStep();
        } else {
          failActiveStep();
          setStatus('error');
          setError('Failed to import the example spec.');
        }
      }
    } catch {
      failActiveStep();
      setStatus('error');
      setError('Failed to load the example. Check your connection and try again.');
    }
    setLoadingExample(null);
  };

  return (
    <div
      className={`relative ${className || ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        {/* Drop overlay */}
        {dragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border-2 border-dashed border-accent flex items-center justify-center">
                <Upload size={22} className="text-accent" />
              </div>
              <p className="text-sm font-medium text-text-primary">Drop your spec file</p>
              <p className="text-xs text-text-muted">OpenAPI, Swagger, or .proto</p>
            </div>
          </div>
        )}

        {/* Search bar — hidden in manual/grpc modes */}
        {!showManual && !showGrpcSetup && (
          <div className="relative">
            <div className="relative flex items-center command-bar-glow rounded-2xl">
              {status === 'resolving' ? (
                <Loader2 size={16} className="absolute left-4 text-accent z-10 animate-spin" />
              ) : (
                <Search size={16} className="absolute left-4 text-text-muted z-10" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); if (status === 'error' || status === 'resolved') reset(); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                onPaste={handlePaste}
                placeholder=""
                disabled={status === 'resolving'}
                className="w-full pl-11 pr-14 py-3.5 text-sm rounded-2xl bg-bg-secondary border border-transparent text-text-primary focus:outline-none transition-all disabled:opacity-60 relative"
              />
              {!input && status === 'idle' && (
                <WavePlaceholder text={placeholder.text} phase={placeholder.phase} />
              )}
              {!input && status === 'resolving' && steps.length > 0 && (
                <span className="absolute left-11 text-sm text-text-muted pointer-events-none select-none z-[2]">
                  {steps.filter(s => s.status === 'active')[0]?.text || steps[steps.length - 1]?.text}
                </span>
              )}
              {input.trim() && status !== 'resolving' && (
                <button
                  onClick={handleSubmit}
                  className="absolute right-2 p-2 rounded-xl text-white bg-accent hover:bg-accent-hover transition-all duration-200 z-10 cursor-pointer"
                >
                  <Send size={14} />
                </button>
              )}
            </div>

            {/* Searching shimmer bar */}
            {status === 'resolving' && (
              <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full discovery-search-bar" />
              </div>
            )}
          </div>
        )}

        {/* Result card — slides up below the search bar */}
        {status === 'resolved' && result && (
          <div className="mt-3 discovery-result-enter">
            <button
              onClick={() => handleConnect(result)}
              className="w-full group rounded-xl bg-bg-secondary border border-border hover:border-accent/40 p-4 text-left transition-all duration-200 hover:bg-bg-hover"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Globe size={18} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{result.name}</h3>
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-bg-tertiary text-[10px] text-text-muted font-medium">
                      {result.specType === 'graphql' ? 'GraphQL' : result.specType === 'grpc' ? 'gRPC' : result.specType === 'manual' ? 'Manual' : 'REST'}
                    </span>
                  </div>
                  {result.description && (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{result.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {result.endpointCount > 0 && (
                    <span className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-semibold tabular-nums">
                      {result.endpointCount} endpoints
                    </span>
                  )}
                  <ChevronRight size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                </div>
              </div>
              {result.baseUrl && (
                <p className="text-[11px] font-mono text-text-muted mt-2 ml-[52px] truncate">{result.baseUrl}</p>
              )}
            </button>

            {/* Additional discovery results */}
            {result.discoveryResults && result.discoveryResults.length > 1 && (
              result.discoveryResults.filter(r => r.name !== result.name).map((r, i) => (
                <button
                  key={i}
                  onClick={() => setResult({
                    name: r.name,
                    description: r.description,
                    baseUrl: r.baseUrl,
                    specUrl: r.specUrl,
                    endpointCount: r.endpointCount,
                    specType: r.specType,
                    endpoints: r.endpoints,
                    discoveryResults: result.discoveryResults,
                  })}
                  className="w-full group rounded-xl bg-bg-secondary border border-border hover:border-accent/40 p-4 text-left transition-all duration-200 hover:bg-bg-hover mt-2 discovery-result-enter"
                  style={{ animationDelay: `${(i + 1) * 60}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center shrink-0">
                      <Globe size={18} className="text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">{r.name}</h3>
                      {r.baseUrl && (
                        <p className="text-[11px] font-mono text-text-muted mt-0.5 truncate">{r.baseUrl}</p>
                      )}
                    </div>
                    {r.endpointCount > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-bg-tertiary text-text-muted text-[11px] font-medium tabular-nums shrink-0">
                        {r.endpointCount}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-text-muted group-hover:text-accent transition-colors shrink-0" />
                  </div>
                </button>
              ))
            )}

            {/* Reset link */}
            <div className="mt-3 text-center">
              <button
                onClick={() => { reset(); setInput(''); inputRef.current?.focus(); }}
                className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                Search for a different API
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <div className="flex items-center gap-2 mt-3 px-1 animate-fade-in">
            <AlertCircle size={13} className="text-warning shrink-0" />
            <span className="text-xs text-text-muted">{error}</span>
          </div>
        )}

        {/* Manual form */}
        {showManual && (
          <div className="animate-fade-in">
            <div className="rounded-xl bg-bg-secondary border border-border p-4 space-y-3">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="API name"
                autoFocus
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="Base URL (e.g. https://api.example.com)"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualName.trim() || !manualUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors font-medium"
                >
                  <Plus size={14} /> Add Connection
                </button>
                <button
                  onClick={() => { setShowManual(false); setManualName(''); setManualUrl(''); inputRef.current?.focus(); }}
                  className="px-4 py-2.5 text-xs rounded-xl bg-bg-tertiary border border-border hover:bg-bg-hover text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Or divider + drop zone + manual link — idle state only */}
        {status === 'idle' && !showManual && !showGrpcSetup && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[10px] uppercase tracking-widest text-text-muted/40 font-medium">or</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            <button
              onClick={handleBrowseFile}
              className="w-full py-6 rounded-xl border border-dashed border-border/50 hover:border-accent/30 hover:bg-accent/[0.03] transition-all duration-200 cursor-pointer group"
            >
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-bg-tertiary/60 group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                  <Upload size={16} className="text-text-muted/50 group-hover:text-accent/70 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-text-muted/70">
                    Drop a spec file here or{' '}
                    <span className="text-accent/80 group-hover:text-accent font-medium">browse</span>
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    {['.json', '.yaml', '.proto', '.graphql'].map((ext) => (
                      <span key={ext} className="px-1.5 py-0.5 rounded bg-bg-tertiary/50 text-[9px] font-mono text-text-muted/40">{ext}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>

            <div className="flex justify-center mt-3">
              <button
                onClick={() => setShowManual(true)}
                className="text-[11px] text-text-muted/50 hover:text-text-muted transition-colors"
              >
                or add manually
              </button>
            </div>
          </>
        )}

        {showGrpcSetup && (
          <div className="animate-fade-in">
            <div className="rounded-xl border border-accent/20 bg-bg-secondary p-4 space-y-3">
              {grpcProtoPath && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border">
                  <FileJson size={12} className="text-accent shrink-0" />
                  <span className="text-[10px] font-mono text-text-secondary truncate">{grpcProtoPath}</span>
                  <button
                    onClick={handleBrowseFile}
                    className="ml-auto text-[10px] text-accent hover:text-accent-hover transition-colors shrink-0"
                  >
                    Change
                  </button>
                </div>
              )}
              <input
                type="text"
                value={grpcName}
                onChange={(e) => setGrpcName(e.target.value)}
                placeholder="Service name (optional)"
                className="w-full px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <input
                type="text"
                value={grpcServerUrl}
                onChange={(e) => setGrpcServerUrl(e.target.value)}
                placeholder="Server address — e.g. localhost:50051"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGrpcConnect}
                  disabled={!grpcServerUrl.trim() || !grpcProtoPath || grpcLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-colors font-medium"
                >
                  {grpcLoading ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                  Connect
                </button>
                <button
                  onClick={() => { setShowGrpcSetup(false); setGrpcProtoPath(''); setGrpcServerUrl(''); setGrpcName(''); }}
                  className="px-4 py-2.5 text-xs rounded-xl bg-bg-tertiary border border-border hover:bg-bg-hover text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick examples */}
        {quickExamples && quickExamples.length > 0 && status === 'idle' && !showManual && !showGrpcSetup && (
          <div className="mt-5">
            <p className="text-[10px] text-text-muted mb-2.5 text-center">Quick start</p>
            <div className="flex flex-col gap-1.5">
              {quickExamples.map((example) => {
                const isLoading = loadingExample === example.url;
                return (
                  <button
                    key={example.url}
                    onClick={() => handleQuickExample(example)}
                    disabled={!!loadingExample}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-secondary/60 border border-border/50 hover:border-accent/30 text-left transition-colors disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 size={14} className="text-accent shrink-0 animate-spin" />
                    ) : (
                      <example.icon size={14} className={`${example.color} shrink-0`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-text-primary font-medium">{example.label}</span>
                      <span className="block text-[10px] text-text-muted">{example.desc}</span>
                    </div>
                    <ChevronRight size={12} className="text-text-muted shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

    </div>
  );
}

export function SmartAddPanel({ onConnected, quickExamples }: {
  onConnected?: (name: string, count: number, type: 'openapi' | 'graphql' | 'grpc') => void;
  quickExamples?: QuickExample[];
} = {}) {
  return (
    <div className="relative h-full flex flex-col items-center justify-center">
      <div className="w-full max-w-lg px-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center mb-3">
            <Plug size={18} className="text-text-muted" />
          </div>
          <h2 className="text-base font-semibold text-text-primary mb-1">Connect an API</h2>
          <p className="text-[11px] text-text-muted/70">
            Search by name, paste a URL, or import a spec file
          </p>
        </div>
        <SpecInput onConnected={onConnected} quickExamples={quickExamples} />
      </div>
    </div>
  );
}

function endpointToCurl(conn: ApiConnection, ep: ApiEndpoint): string {
  if (conn.specType === 'grpc') {
    const resolveString = useEnvironmentStore.getState().resolveString;
    const serverUrl = resolveString(conn.baseUrl);
    return `grpcurl -plaintext \\\n  -d '{}' \\\n  ${serverUrl} \\\n  ${ep.path.replace('/', '.')}`;
  }

  const resolveString = useEnvironmentStore.getState().resolveString;
  const baseUrl = resolveString(conn.baseUrl).replace(/\/+$/, '');
  const url = baseUrl + ep.path;

  const parts = [`curl -X ${ep.method}`];

  const queryParams = ep.parameters?.filter(p => p.in === 'query') || [];
  const headerParams = ep.parameters?.filter(p => p.in === 'header') || [];

  let fullUrl = url;
  if (queryParams.length > 0) {
    const qs = queryParams.map(p => `${encodeURIComponent(p.name)}=\${${p.name}}`).join('&');
    fullUrl = `${url}?${qs}`;
  }
  parts.push(`  '${fullUrl}'`);

  if (conn.auth.type === 'bearer') {
    parts.push(`  -H 'Authorization: Bearer \${TOKEN}'`);
  } else if (conn.auth.type === 'basic') {
    parts.push(`  -u '\${USERNAME}:\${PASSWORD}'`);
  } else if (conn.auth.type === 'api-key' && conn.auth.apiKey) {
    if (conn.auth.apiKey.addTo === 'header') {
      parts.push(`  -H '${conn.auth.apiKey.key}: \${API_KEY}'`);
    }
  }

  for (const h of headerParams) {
    parts.push(`  -H '${h.name}: \${${h.name.toUpperCase().replace(/-/g, '_')}}'`);
  }

  if (ep.requestBody?.type === 'json') {
    parts.push(`  -H 'Content-Type: application/json'`);
    if (ep.requestBody.example) {
      parts.push(`  -d '${ep.requestBody.example}'`);
    } else {
      const bodyParams = (ep.parameters || []).filter(p => p.in === 'body');
      if (bodyParams.length > 0) {
        const template: Record<string, any> = {};
        for (const bp of bodyParams) template[bp.name] = `<${bp.type}>`;
        parts.push(`  -d '${JSON.stringify(template)}'`);
      } else {
        parts.push(`  -d '{}'`);
      }
    }
  }

  return parts.join(' \\\n');
}

function VariableHighlightedUrl({ url }: { url: string }) {
  return <VariableHighlight text={url} />;
}

function ParamTable({ params, title }: { params: EndpointParam[]; title: string }) {
  if (params.length === 0) return null;
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-tertiary text-text-muted">
              <th className="text-left px-3 py-1.5 font-medium">Name</th>
              <th className="text-left px-3 py-1.5 font-medium">Type</th>
              <th className="text-left px-3 py-1.5 font-medium hidden sm:table-cell">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2">
                  <code className="text-text-primary font-mono text-[11px]">{p.name}</code>
                  {p.required && <span className="text-error ml-1 text-[9px]">*</span>}
                </td>
                <td className="px-3 py-2 text-text-muted font-mono text-[10px]">{p.type}</td>
                <td className="px-3 py-2 text-text-muted hidden sm:table-cell">
                  {p.description ? (
                    <span className="[&_p]:inline [&_p]:m-0 [&_a]:text-accent [&_a]:underline [&_code]:bg-bg-tertiary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_code]:font-mono [&_strong]:text-text-primary [&_em]:text-text-secondary">
                      <Markdown>{p.description.replace(/\n{2,}/g, ' ')}</Markdown>
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SchemaBlock({ schema, label }: { schema: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(schema);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{label}</h4>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="rounded-lg bg-bg-tertiary border border-border p-3 overflow-x-auto text-[11px] font-mono text-text-secondary leading-relaxed max-h-64 overflow-y-auto">
        {schema}
      </pre>
    </div>
  );
}

const GRPC_METHOD_TYPE_META: Record<string, { label: string; color: string }> = {
  unary: { label: 'UNARY', color: '#22c55e' },
  server_streaming: { label: 'S.STRM', color: '#3b82f6' },
  client_streaming: { label: 'C.STRM', color: '#f59e0b' },
  bidi_streaming: { label: 'BIDI', color: '#a855f7' },
};

function EndpointRow({ conn, ep, onRun }: { conn: ApiConnection; ep: ApiEndpoint; onRun: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);

  const pathParams = ep.parameters?.filter(p => p.in === 'path') || [];
  const queryParams = ep.parameters?.filter(p => p.in === 'query') || [];
  const headerParams = ep.parameters?.filter(p => p.in === 'header') || [];
  const bodyParams = ep.parameters?.filter(p => p.in === 'body') || [];
  const hasDetails = pathParams.length > 0 || queryParams.length > 0 || headerParams.length > 0
    || bodyParams.length > 0 || ep.description || ep.requestBody;

  const isGrpc = conn.specType === 'grpc';
  let grpcMethodType: string | null = null;
  if (isGrpc && ep.requestBody?.schema) {
    try {
      const meta = JSON.parse(ep.requestBody.schema);
      grpcMethodType = meta.methodType || null;
    } catch {}
  }
  const grpcMeta = grpcMethodType ? GRPC_METHOD_TYPE_META[grpcMethodType] : null;

  const copyCurl = () => {
    navigator.clipboard.writeText(endpointToCurl(conn, ep));
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 1500);
  };

  return (
    <div className="border-t border-border">
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition-colors cursor-pointer group"
        onClick={() => hasDetails ? setExpanded(!expanded) : onRun()}
      >
        {isGrpc && grpcMeta ? (
          <span
            className="font-mono font-bold text-[9px] w-14 text-left shrink-0 tracking-wider"
            style={{ color: grpcMeta.color }}
          >
            {grpcMeta.label}
          </span>
        ) : (
          <span
            className="font-mono font-bold text-[10px] w-14 text-left shrink-0"
            style={{ color: METHOD_COLORS[ep.method] || '#6b7280' }}
          >
            {ep.method}
          </span>
        )}
        <span className="text-xs font-mono text-text-secondary flex-1 truncate">{ep.path}</span>
        <span className="text-[10px] text-text-muted truncate max-w-[200px] hidden sm:block">{ep.summary}</span>
        <div className="flex items-center gap-1 shrink-0">
          {hasDetails && (
            <span className="text-text-muted">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className="p-1 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent transition-all"
            title="Try it"
          >
            <Play size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 bg-bg-primary/50 border-t border-border/50">
          <div className="pt-3 flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-bg-tertiary rounded-lg px-3 py-2 border border-border">
              <span
                className="font-mono font-bold text-[10px] shrink-0"
                style={{ color: METHOD_COLORS[ep.method] || '#6b7280' }}
              >
                {ep.method}
              </span>
              <span className="text-xs text-text-secondary font-mono truncate">
                <VariableHighlightedUrl url={conn.baseUrl + ep.path} />
              </span>
            </div>
            <button
              onClick={copyCurl}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-bg-tertiary border border-border text-[10px] text-text-muted hover:text-text-primary hover:border-border-light transition-colors shrink-0"
              title={isGrpc ? 'Copy as grpcurl' : 'Copy as cURL'}
            >
              {curlCopied ? <Check size={11} className="text-green-400" /> : <Terminal size={11} />}
              <span>{curlCopied ? 'Copied' : isGrpc ? 'grpcurl' : 'cURL'}</span>
            </button>
            <button
              onClick={onRun}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-[10px] font-medium hover:bg-accent-hover transition-colors shrink-0"
            >
              <Play size={11} />
              <span>{isGrpc ? 'Invoke' : 'Try it'}</span>
            </button>
          </div>

          {ep.description && (
            <div className="text-xs text-text-secondary leading-relaxed [&_a]:text-accent [&_a]:underline [&_code]:bg-bg-tertiary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_code]:font-mono [&_p]:my-1 first:[&_p]:mt-0 last:[&_p]:mb-0 [&_strong]:text-text-primary [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1 [&_li]:my-0.5">
              <Markdown>{ep.description}</Markdown>
            </div>
          )}

          <ParamTable params={pathParams} title="Path Parameters" />
          <ParamTable params={queryParams} title="Query Parameters" />
          <ParamTable params={headerParams} title="Headers" />

          {bodyParams.length > 0 && (
            <ParamTable params={bodyParams} title="Body Fields" />
          )}
          {ep.requestBody?.example && (
            <SchemaBlock schema={ep.requestBody.example} label="Example" />
          )}
          {ep.requestBody?.schema && bodyParams.length === 0 && !ep.requestBody.schema.includes('$ref') && (
            <SchemaBlock schema={ep.requestBody.schema} label="Request Body Schema" />
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionAuthSection({ conn }: { conn: ApiConnection }) {
  const [expanded, setExpanded] = useState(conn.auth.type !== 'none');
  const updateConnection = useConnectionStore((s) => s.updateConnection);

  const handleAuthChange = (auth: AuthConfig) => {
    updateConnection(conn.id, { auth });
  };

  return (
    <div className="mb-4 rounded-xl border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left ${expanded ? 'rounded-t-xl' : 'rounded-xl'}`}
      >
        <div className="flex items-center gap-2">
          <Shield size={13} className={conn.auth.type !== 'none' ? 'text-green-400' : 'text-text-muted'} />
          <span className="text-xs font-semibold text-text-primary">Authentication</span>
          {conn.auth.type !== 'none' && (
            <span className="text-[10px] text-green-400 font-medium">
              {AUTH_TYPE_LABELS[conn.auth.type]}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronDown size={13} className="text-text-muted" />
          : <ChevronRight size={13} className="text-text-muted" />
        }
      </button>
      {expanded && (
        <div className="px-4 py-3 border-t border-border/50 bg-bg-primary">
          <AuthEditorCore auth={conn.auth} onAuthChange={handleAuthChange} />
        </div>
      )}
    </div>
  );
}

function ConnectionDetail({ conn, isArchived, searchQuery, setSearchQuery, onRunEndpoint, onArchive }: {
  conn: ApiConnection;
  isArchived?: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRunEndpoint: (conn: ApiConnection, ep: ApiEndpoint) => void;
  onArchive: () => void;
}) {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['all']));
  const [reimporting, setReimporting] = useState(false);
  const reimportSpec = useConnectionStore((s) => s.reimportSpec);
  const { environments, activeEnvironmentId } = useEnvironmentStore();
  const resolveString = useEnvironmentStore((s) => s.resolveString);
  const setActiveView = useUiStore((s) => s.setActiveView);

  const activeEnv = environments.find(e => e.id === activeEnvironmentId);
  const resolvedBaseUrl = resolveString(conn.baseUrl);
  const hasVariables = VARIABLE_REGEX.test(conn.baseUrl);

  const filtered = searchQuery
    ? conn.endpoints.filter(ep =>
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.method.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conn.endpoints;

  const methodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ep of conn.endpoints) {
      counts[ep.method] = (counts[ep.method] || 0) + 1;
    }
    return counts;
  }, [conn.endpoints]);

  const tags = Array.from(new Set(filtered.flatMap(ep => ep.tags || ['Other']))).sort();
  const byTag = tags.length > 0
    ? tags.map(tag => ({
        tag,
        endpoints: filtered.filter(ep => (ep.tags || ['Other']).includes(tag)),
      }))
    : [{ tag: 'Endpoints', endpoints: filtered }];

  const toggleTag = (tag: string) => {
    const next = new Set(expandedTags);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    setExpandedTags(next);
  };

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <IconCustomizer conn={conn} />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{conn.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted font-mono">
                {hasVariables ? <VariableHighlightedUrl url={conn.baseUrl} /> : conn.baseUrl}
              </span>
              {conn.specUrl && (
                <a
                  href={conn.specUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-accent transition-colors"
                  title="View spec"
                >
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {conn.specUrl && conn.specType === 'openapi' && (
            <button
              onClick={async () => {
                setReimporting(true);
                await reimportSpec(conn.id);
                setReimporting(false);
              }}
              disabled={reimporting}
              className="p-2 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
              title="Re-import spec (resolves schemas)"
            >
              <RefreshCw size={14} className={reimporting ? 'animate-spin' : ''} />
            </button>
          )}
          {!isArchived && (
            <button
              onClick={onArchive}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Archive connection"
            >
              <Archive size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Badges Row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-tertiary border border-border text-[10px] text-text-muted">
          {conn.specType === 'openapi' && <><Code2 size={10} /> OpenAPI</>}
          {conn.specType === 'graphql' && <><Braces size={10} /> GraphQL</>}
          {conn.specType === 'grpc' && <><Radio size={10} /> gRPC</>}
          {conn.specType === 'manual' && <><FileJson size={10} /> Manual</>}
          {conn.specType === 'imported' && <><FileJson size={10} /> Imported</>}
        </span>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-tertiary border border-border text-[10px] text-text-muted">
          {conn.endpoints.length} {conn.specType === 'grpc' ? 'method' : conn.specType === 'graphql' ? 'operation' : 'endpoint'}{conn.endpoints.length !== 1 ? 's' : ''}
        </span>

        {Object.entries(methodCounts).map(([method, count]) => (
          <span
            key={method}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold"
            style={{ color: METHOD_COLORS[method] || '#6b7280', background: `${METHOD_COLORS[method] || '#6b7280'}15` }}
          >
            {count} {method}
          </span>
        ))}

        {activeEnv && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-[10px] text-accent">
            <Globe size={10} />
            {activeEnv.name}
          </span>
        )}
      </div>

      {/* Authentication */}
      <ConnectionAuthSection conn={conn} />

      {/* Description */}
      {conn.description && (
        <div className="mb-4 text-xs text-text-secondary leading-relaxed [&_a]:text-accent [&_a]:underline [&_code]:bg-bg-tertiary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:font-mono [&_p]:my-1 first:[&_p]:mt-0 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-text-primary [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-text-primary [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-text-primary [&_h3]:text-xs [&_h3]:font-medium [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/30 [&_blockquote]:pl-3 [&_blockquote]:text-text-muted [&_blockquote]:italic [&_pre]:bg-bg-tertiary [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:overflow-x-auto [&_pre]:my-1">
          <Markdown>{conn.description}</Markdown>
        </div>
      )}

      {/* Environment hint */}
      {hasVariables && activeEnv && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
          <Layers size={12} className="text-accent shrink-0" />
          <span className="text-[11px] text-text-muted">
            Variables resolved from <button onClick={() => setActiveView('environments')} className="text-accent hover:underline font-medium">{activeEnv.name}</button>
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${conn.endpoints.length} ${conn.specType === 'grpc' ? 'methods' : conn.specType === 'graphql' ? 'operations' : 'endpoints'}...`}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Endpoints */}
      <div className="space-y-2">
        {byTag.map(({ tag, endpoints }) => (
          <div key={tag} className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleTag(tag)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                {expandedTags.has(tag) ? <ChevronDown size={13} className="text-text-muted" /> : <ChevronRight size={13} className="text-text-muted" />}
                <span className="text-xs font-semibold text-text-primary">{tag}</span>
              </div>
              <span className="text-[10px] text-text-muted">{endpoints.length}</span>
            </button>
            {expandedTags.has(tag) && (
              <div>
                {endpoints.map((ep) => (
                  <EndpointRow
                    key={ep.id}
                    conn={conn}
                    ep={ep}
                    onRun={() => onRunEndpoint(conn, ep)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-muted">
              {searchQuery ? 'No matching endpoints' : 'No endpoints defined. Add them manually or import a spec.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
