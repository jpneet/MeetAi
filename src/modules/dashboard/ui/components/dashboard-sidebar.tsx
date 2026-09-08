"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BotIcon, StarIcon, VideoIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { DashboardUserButton } from "./dashboard-user-button";
import { DashboardTrial } from "./dashboard-trial";

const firstSection = [
  {
    icon: VideoIcon,
    label: "Meetings",
    href: "/meetings",
  },
  {
    icon: BotIcon,
    label: "Agents",
    href: "/agents",
  },
];

const secondSection = [
  {
    icon: StarIcon,
    label: "Upgrade",
    href: "/upgrade",
  },
];

export const DashboardSidebar = () => {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderMenuItems = (
    items: typeof firstSection
  ) => {
    return items.map((item) => {
      const isActive = pathname === item.href;

      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            className={cn(
              "h-10 border border-transparent text-[#AFC4D8] transition-all",
              "hover:border-[#0094F7]/20",
              "hover:bg-[#0D2235]",
              "hover:text-white",
              isActive &&
                "border-[#0094F7]/20 bg-[#0D2235] text-white"
            )}
          >
            <Link href={item.href} onClick={handleNavClick}>
              <item.icon
                className={cn(
                  "size-5",
                  isActive && "text-[#0094F7]"
                )}
              />

              <span className="text-sm font-medium tracking-tight">
                {item.label}
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  };

  return (
    <Sidebar className="border-r border-[#0094F7]/15">
      {/* Header */}
      <SidebarHeader className="bg-[#07111C] text-white">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 pt-3"
          onClick={handleNavClick}
        >
          <Image
            src="/logo.svg"
            height={36}
            width={36}
            alt="Meet.AI"
          />

          <p className="text-2xl font-semibold tracking-tight">
            Meet<span className="text-[#0094F7]">.AI</span>
          </p>
        </Link>
      </SidebarHeader>

      {/* Header separator */}
      <div className="bg-[#07111C] px-4 py-2">
        <Separator className="bg-[#0094F7]/15" />
      </div>

      {/* Navigation */}
      <SidebarContent className="bg-[#07111C]">
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(firstSection)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Section separator */}
        <div className="px-4 py-2">
          <Separator className="bg-[#0094F7]/15" />
        </div>

        {/* Upgrade */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(secondSection)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="bg-[#07111C] p-0">
        <DashboardTrial />
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
};