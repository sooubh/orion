import React from "react";
import SettingsButton from "../SettingsButton";
import { isMobile } from "react-device-detect";
import { ShieldCheck, Database, Cpu } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import {
  BookOpen,
  Briefcase,
  Envelope,
  Globe,
  HouseLine,
  Info,
  LinkSimple,
} from "@phosphor-icons/react";

export const MAX_ICONS = 3;
export const ICON_COMPONENTS = {
  BookOpen: BookOpen,
  Envelope: Envelope,
  LinkSimple: LinkSimple,
  HouseLine: HouseLine,
  Globe: Globe,
  Briefcase: Briefcase,
  Info: Info,
};

export default function Footer() {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-500">
      <div className="flex items-center gap-2">
        <Link
          to={paths.security()}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors"
          title="100% Local & Isolated"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>Zero Egress</span>
        </Link>
      </div>
      {!isMobile && <SettingsButton />}
    </div>
  );
}

