import { IoCalendarOutline, IoSearch, IoSwapVertical } from "react-icons/io5";
import type { TaskViewMode } from "./taskView";
import type { Selection } from "react-aria-components";
import type { MultiSelectItemType } from "../base/input/multi-select";
import FilterInput from "@/ui/filter/FilterInput";
import FilterSelect from "@/ui/filter/FilterSelect";
import FilterButton from "@/ui/filter/FilterButton";
import type { GroupSortConfig, TaskSortConfig } from "../../lib/taskSort";
import { sortLabel } from "../../lib/taskSort";
import { TasksSortMenu } from "./TasksSortMenu";

export type TasksHeaderProps = {
  taskSearch: string;
  onTaskSearchChange: (value: string) => void;
  blockFilters: Set<string>;
  onBlockFiltersChange: (value: Set<string>) => void;
  categoryFilters: Set<string>;
  onCategoryFiltersChange: (value: Set<string>) => void;
  dueTodayOnly: boolean;
  onDueTodayOnlyChange: (value: boolean) => void;
  blocks: string[];
  categories: string[];
  sortMenuOpen: boolean;
  onSortMenuOpenChange: (open: boolean) => void;
  taskSort: TaskSortConfig;
  onTaskSortChange: (config: TaskSortConfig) => void;
  groupSort: GroupSortConfig;
  onGroupSortChange: (config: GroupSortConfig) => void;
  viewMode: TaskViewMode;
  hideCategoryFilter?: boolean;
};

export function TasksHeader({
  taskSearch,
  onTaskSearchChange,
  blockFilters,
  onBlockFiltersChange,
  categoryFilters,
  onCategoryFiltersChange,
  dueTodayOnly,
  onDueTodayOnlyChange,
  blocks,
  categories,
  sortMenuOpen,
  onSortMenuOpenChange,
  taskSort,
  onTaskSortChange,
  groupSort,
  onGroupSortChange,
  viewMode,
  hideCategoryFilter = false,
}: TasksHeaderProps) {
  const blockItems: MultiSelectItemType[] = blocks.map((block) => ({
    id: block,
    label: block,
    textValue: block,
  }));
  const categoryItems: MultiSelectItemType[] = categories.map((category) => ({
    id: category,
    label: category,
    textValue: category,
  }));

  const selectionToSet = (selection: Selection, values: string[]): Set<string> => {
    if (selection === "all") return new Set(values);
    if (selection instanceof Set) {
      return new Set(Array.from(selection, (value) => String(value)));
    }
    return new Set<string>();
  };

  return (
    <header className="shrink-0 px-5 pb-4 pt-6 sm:px-8 sm:pb-5 sm:pt-8">
      {/* The fixed TasksSideRail sits 16px from the right edge and is 60px wide;
          cap the centered column so its right edge always clears it. */}
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-5 sm:max-w-[min(48rem,calc(100%-6.5rem))] xl:max-w-[min(56rem,calc(100%-6.5rem))]">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <FilterInput
            type="search"
            icon={<IoSearch />}
            value={taskSearch}
            onChange={(e) => onTaskSearchChange(e.target.value)}
            placeholder="Search tasks, category, or tags…"
            autoComplete="off"
            aria-label="Search tasks by title, category, or tags"
            className="flex-1 sm:min-w-[200px]"
          />

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="w-44">
              <FilterSelect
                items={blockItems}
                selectedKeys={blockFilters}
                onSelectionChange={(keys) =>
                  onBlockFiltersChange(selectionToSet(keys, blocks))
                }
                placeholder="All blocks"
                showFooter
                selectedCountFormatter={(count) =>
                  count === 1 ? "1 block" : `${count} blocks`
                }
              />
            </div>

            {!hideCategoryFilter ? (
              <div className="w-48">
                <FilterSelect
                  items={categoryItems}
                  selectedKeys={categoryFilters}
                  onSelectionChange={(keys) =>
                    onCategoryFiltersChange(selectionToSet(keys, categories))
                  }
                  placeholder="All categories"
                  showFooter
                  selectedCountFormatter={(count) =>
                    count === 1 ? "1 category" : `${count} categories`
                  }
                />
              </div>
            ) : null}

            <FilterButton
              icon={<IoCalendarOutline />}
              active={dueTodayOnly}
              onClick={() => onDueTodayOnlyChange(!dueTodayOnly)}
            >
              Due Today
            </FilterButton>

            <FilterButton
              icon={<IoSwapVertical />}
              active={sortMenuOpen}
              aria-expanded={sortMenuOpen}
              onClick={() => onSortMenuOpenChange(!sortMenuOpen)}
              className="sm:hidden"
            >
              Sort
            </FilterButton>
          </div>
        </div>

        {sortMenuOpen ? (
          <div className="sm:hidden">
            <TasksSortMenu
              open={sortMenuOpen}
              onClose={() => onSortMenuOpenChange(false)}
              taskSort={taskSort}
              onTaskSortChange={onTaskSortChange}
              groupSort={groupSort}
              onGroupSortChange={onGroupSortChange}
              hideSectionOrder={viewMode === "all"}
              className="w-full"
            />
            <p className="mt-2 text-xs text-muted">
              {sortLabel(taskSort)}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
