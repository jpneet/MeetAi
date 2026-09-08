import Link from "next/link";
import { ChevronRightIcon, TrashIcon, PencilIcon, MoreVerticalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Props {
  meetingId: string;
  meetingName: string;
  onEdit: () => void;
  onRemove: () => void;
}

export const MeetingIdViewHeader = ({
  meetingId,
  meetingName,
  onEdit,
  onRemove
}: Props) => {
  return (
    <div className="flex items-center justify-between">
      <Breadcrumb>
        <BreadcrumbList className="text-sm sm:text-base">
          <BreadcrumbItem>
            <BreadcrumbLink asChild className="font-medium text-muted-foreground hover:text-foreground">
              <Link href="/meetings">
                My Meetings
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-muted-foreground [&>svg]:size-3.5">
            <ChevronRightIcon />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild className="font-semibold text-foreground truncate max-w-50 sm:max-w-md">
              <Link href={`/meetings/${meetingId}`}>
                {meetingName}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {/* Without modal={false}, the dialog that this dropdown opens cause the website to get unclickable */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon className="size-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
            <TrashIcon className="size-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
