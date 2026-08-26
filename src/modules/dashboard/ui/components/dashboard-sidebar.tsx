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
} from "@/components/ui/sidebar";
import { DashboardUserButton } from "./dashboard-user-button";

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

  return (
    <Sidebar
  className="border-r border-[#0094F7]/15">
  <SidebarHeader className="bg-[#07111C] text-white">
    <Link
      href="/"
      className="flex items-center gap-2 px-2 pt-3"
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

  <div className="bg-[#07111C] px-4 py-2">
    <Separator className="bg-[#0094F7]/15" />
  </div>

  <SidebarContent className="bg-[#07111C]">
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {firstSection.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                className={cn(
                  "h-10 border border-transparent text-[#AFC4D8] transition-all",
                  "hover:border-[#0094F7]/20",
                  "hover:bg-[#0D2235]",
                  "hover:text-white",
                  pathname === item.href &&
                    "border-[#0094F7]/20 bg-[#0D2235] text-white"
                )}
                isActive={pathname === item.href}
              >
                <Link href={item.href}>
                  <item.icon
                    className={cn(
                      "size-5",
                      pathname === item.href &&
                        "text-[#0094F7]"
                    )}
                  />

                  <span className="text-sm font-medium tracking-tight">
                    {item.label}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>

    <div className="px-4 py-2">
      <Separator className="bg-[#0094F7]/15" />
    </div>

    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {secondSection.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                className={cn(
                  "h-10 border border-transparent text-[#AFC4D8] transition-all",
                  "hover:border-[#0094F7]/20",
                  "hover:bg-[#0D2235]",
                  "hover:text-white",
                  pathname === item.href &&
                    "border-[#0094F7]/20 bg-[#0D2235] text-white"
                )}
                isActive={pathname === item.href}
              >
                <Link href={item.href}>
                  <item.icon
                    className={cn(
                      "size-5",
                      pathname === item.href &&
                        "text-[#0094F7]"
                    )}
                  />

                  <span className="text-sm font-medium tracking-tight">
                    {item.label}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
      <SidebarFooter className="bg-[#07111C] p-0">
  <DashboardUserButton />
</SidebarFooter>
</Sidebar>
  );
};