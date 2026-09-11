"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRightIcon,
  BotIcon,
  CalendarIcon,
  SparklesIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { NewMeetingDialog } from "@/modules/meetings/ui/components/new-meeting-dialog";
import { NewAgentDialog } from "@/modules/agents/ui/components/new-agent-dialog";
import { Bodoni_Moda } from "next/font/google";
import { Cinzel_Decorative } from "next/font/google";

const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel-decorative",
});

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bodoni-moda",
});

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";

  return "Good Evening";
}

export const HomeView = () => {
  const { data: session } = authClient.useSession();

  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);

  const userName = session?.user?.name ?? "there";
  const greeting = getGreeting();

  return (
    <>
      <NewMeetingDialog
        open={meetingDialogOpen}
        onOpenChange={setMeetingDialogOpen}
      />

      <NewAgentDialog
        open={agentDialogOpen}
        onOpenChange={setAgentDialogOpen}
      />

      <div
        className={`home-view ${cinzelDecorative.variable} ${bodoniModa.variable}`}
      >
        {/* Breadcrumb */}
        <p className="home-view__breadcrumb"></p>

        {/* Greeting */}
        <h1 className="home-view__greeting">
          {greeting}, {userName}
        </h1>

        {/* Hero Card */}
        <div className="home-hero">
          {/* Ambient glow */}
          <div className="home-hero__glow" />

          {/* Left content */}
          <div className="home-hero__content">
            <div className="home-hero__badge">
              <SparklesIcon className="home-hero__badge-icon" />
              <span>MEETAI AI ASSISTANT</span>
            </div>

            <h2 className="home-hero__heading">
              Meetings,but
              <br />
              Smarter.
            </h2>

            <p className="home-hero__description">
              MeetAI helps you host, understand, and turn every conversation
              into actionable insights.
            </p>

            <div className="home-hero__actions">
              <Button
                size="lg"
                onClick={() => setMeetingDialogOpen(true)}
                className="home-hero__btn-primary"
              >
                Start a Meeting
                <ArrowRightIcon className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => setAgentDialogOpen(true)}
                className="home-hero__btn-secondary"
              >
                Create an Agent
              </Button>
            </div>
          </div>

          {/* Right illustration */}
          <div className="home-hero__illustration">
            {/* AI Assistant Card */}
            <div className="home-floating-card home-floating-card--assistant">
              <div className="home-floating-card__indicator home-floating-card__indicator--green" />

              <div>
                <p className="home-floating-card__title">
                  AI Assistant
                </p>

                <p className="home-floating-card__subtitle">
                  Ready to help
                </p>
              </div>
            </div>

            {/* Upcoming Meetings Card */}
            <div className="home-floating-card home-floating-card--meetings">
              <div className="home-floating-card__icon-wrapper">
                <CalendarIcon className="size-3.5 text-[#0094F7]" />
              </div>

              <div>
                <p className="home-floating-card__title">
                  Upcoming Meetings
                </p>

                <p className="home-floating-card__subtitle">
                  3 meetings today
                </p>
              </div>
            </div>

            {/* AI Insights Card */}
            <div className="home-floating-card home-floating-card--insights">
              <div className="home-floating-card__icon-wrapper">
                <BotIcon className="size-3.5 text-[#0094F7]" />
              </div>

              <div>
                <p className="home-floating-card__title">
                  AI Insights
                </p>

                <p className="home-floating-card__subtitle">
                  12 key moments
                </p>
              </div>
            </div>

            {/* Robot glow */}
            <div className="home-hero__robot-glow" />

            {/* Robot */}
            <Image
              src="/robo.png"
              alt="MeetAI Robot Assistant"
              width={1672}
              height={941}
              className="home-hero__robot"
              priority
            />
          </div>
        </div>
      </div>
    </>
  );
};