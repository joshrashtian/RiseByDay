import type { ReactNode, RefAttributes } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { IoCheckmark, IoChevronDown, IoSearch } from "react-icons/io5";
import { useFilter } from "react-aria";
import type { ListBoxItemProps, Selection } from "react-aria-components";
import {
    Autocomplete as AriaAutocomplete,
    Button as AriaButton,
    Dialog as AriaDialog,
    DialogTrigger as AriaDialogTrigger,
    Input as AriaInput,
    ListBox as AriaListBox,
    ListBoxItem as AriaListBoxItem,
    Popover as AriaPopover,
    SearchField as AriaSearchField,
} from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";

const triggerSizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-3 py-2.5 text-sm",
    lg: "px-3.5 py-3 text-base",
};

const searchSizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-3 py-2.5 text-sm",
    lg: "px-3.5 py-3 text-base",
};

const popoverMaxHeights = {
    sm: "max-h-64",
    md: "max-h-72",
    lg: "max-h-80",
};

const footerButtonSize = {
    sm: "xs" as const,
    md: "sm" as const,
    lg: "sm" as const,
};

type SelectKey = string | number;

export interface MultiSelectItemType {
    id: SelectKey;
    label: ReactNode;
    description?: ReactNode;
    textValue?: string;
    isDisabled?: boolean;
}

interface CommonProps {
    /** The input size. */
    size?: "sm" | "md" | "lg";
    /** Placeholder text shown when nothing is selected. */
    placeholder?: string;
    /** Label shown above the field. */
    label?: string;
    /** Optional helper text below the field. */
    hint?: ReactNode;
    /** Optional tooltip text on the label. */
    tooltip?: string;
    /** Hide required indicator on the label. */
    hideRequiredIndicator?: boolean;
}

interface MultiSelectFooterProps {
    size?: "sm" | "md" | "lg";
    onReset?: () => void;
    onSelectAll?: () => void;
    className?: string;
}

const MultiSelectFooter = ({ size = "sm", onReset, onSelectAll, className }: MultiSelectFooterProps) => {
    const btnSize = footerButtonSize[size];

    return (
        <div className={cx("flex items-center justify-between border-t border-line/80 p-3", className)}>
            <Button size={btnSize} color="secondary" onClick={onReset}>
                Reset
            </Button>
            <Button size={btnSize} color="secondary" onClick={onSelectAll}>
                Select all
            </Button>
        </div>
    );
};

interface MultiSelectEmptyStateProps {
    title?: string;
    description?: string;
    onClearSearch?: () => void;
    className?: string;
}

const MultiSelectEmptyState = ({
    title = "No results found",
    description = "Try a different search term.",
    onClearSearch,
    className,
}: MultiSelectEmptyStateProps) => (
    <div className={cx("flex flex-col items-center gap-2 px-4 py-6 text-center", className)}>
        <div className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-muted">
            <IoSearch className="size-4" aria-hidden />
        </div>
        <div className="space-y-0.5">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-xs text-muted">{description}</p>
        </div>
        {onClearSearch && (
            <Button size="sm" color="link-gray" onClick={onClearSearch}>
                Clear search
            </Button>
        )}
    </div>
);

interface MultiSelectItemProps extends Omit<ListBoxItemProps, "className" | "children"> {
    children: ReactNode;
    className?: string;
    description?: ReactNode;
}

const MultiSelectItem = ({ children, description, className, ...props }: MultiSelectItemProps) => (
    <AriaListBoxItem
        {...props}
        className={({ isFocused, isSelected, isDisabled }) =>
            cx(
                "relative mx-1 flex cursor-pointer items-start justify-between gap-2 rounded-lg px-3 py-2 outline-none transition-colors",
                isFocused && "bg-sunken",
                isSelected && "bg-sunken text-ink",
                isDisabled && "cursor-not-allowed opacity-50",
                className,
            )
        }
    >
        {({ isSelected }) => (
            <>
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{children}</div>
                    {description ? <div className="truncate text-xs text-muted">{description}</div> : null}
                </div>
                <IoCheckmark className={cx("mt-0.5 size-4 shrink-0 text-muted", !isSelected && "invisible")} aria-hidden />
            </>
        )}
    </AriaListBoxItem>
);

interface MultiSelectProps extends RefAttributes<HTMLDivElement>, CommonProps {
    items?: MultiSelectItemType[];
    children?: ReactNode | ((item: MultiSelectItemType) => ReactNode);
    selectedKeys?: Selection;
    defaultSelectedKeys?: Selection;
    onSelectionChange?: (keys: Selection) => void;
    isDisabled?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
    popoverClassName?: string;
    className?: string;
    /** Replaces the default trigger styling (merged last). */
    triggerClassName?: string;
    onReset?: () => void;
    onSelectAll?: () => void;
    showFooter?: boolean;
    showSearch?: boolean;
    emptyStateTitle?: string;
    emptyStateDescription?: string;
    selectedCountFormatter?: (count: number) => ReactNode;
    supportingText?: ReactNode;
}

const MultiSelectRoot = ({
    items,
    children,
    size = "md",
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    isDisabled,
    isRequired,
    isInvalid,
    placeholder = "Select",
    label,
    hint,
    tooltip,
    hideRequiredIndicator,
    popoverClassName,
    className,
    triggerClassName,
    onReset,
    onSelectAll,
    showFooter = true,
    showSearch = true,
    emptyStateTitle,
    emptyStateDescription,
    selectedCountFormatter,
    supportingText,
}: MultiSelectProps) => {
    const { contains } = useFilter({ sensitivity: "base" });
    const triggerRef = useRef<HTMLButtonElement>(null);

    const [searchValue, setSearchValue] = useState("");
    const [uncontrolledKeys, setUncontrolledKeys] = useState<Selection>(defaultSelectedKeys ?? new Set<SelectKey>());

    const isControlled = typeof selectedKeys !== "undefined";
    const resolvedSelectedKeys = isControlled ? selectedKeys : uncontrolledKeys;

    const selectedCount = useMemo(() => {
        if (resolvedSelectedKeys === "all") return items?.length ?? 0;
        if (resolvedSelectedKeys instanceof Set) return resolvedSelectedKeys.size;
        return 0;
    }, [items, resolvedSelectedKeys]);

    const hasSelection = selectedCount > 0;

    const handleSelectionChange = useCallback(
        (keys: Selection) => {
            if (!isControlled) {
                setUncontrolledKeys(keys);
            }
            onSelectionChange?.(keys);
        },
        [isControlled, onSelectionChange],
    );

    const handleReset = useCallback(() => {
        onReset?.();
        if (!onReset) {
            handleSelectionChange(new Set<SelectKey>());
        }
    }, [handleSelectionChange, onReset]);

    const handleSelectAll = useCallback(() => {
        onSelectAll?.();
        if (!onSelectAll && items?.length) {
            const allKeys = new Set<SelectKey>(items.map((item) => item.id));
            handleSelectionChange(allKeys);
        }
    }, [handleSelectionChange, items, onSelectAll]);

    const renderChildren =
        typeof children !== "undefined"
            ? children
            : (item: MultiSelectItemType) => (
                  <MultiSelectItem id={item.id} textValue={item.textValue ?? (typeof item.label === "string" ? item.label : undefined)} isDisabled={item.isDisabled}>
                      {item.label}
                  </MultiSelectItem>
              );

    return (
        <div className={cx("group flex w-full flex-col gap-1.5", className)}>
            {label ? (
                <Label isRequired={hideRequiredIndicator ? false : isRequired} isInvalid={isInvalid} tooltip={tooltip}>
                    {label}
                </Label>
            ) : null}

            <AriaDialogTrigger>
                <AriaButton
                    ref={triggerRef}
                    isDisabled={isDisabled}
                    className={({ isFocusVisible, isDisabled }) =>
                        cx(
                            "flex w-full items-center gap-2 rounded-xl border border-line-strong/80 bg-surface/80 text-left text-ink shadow-sm transition-colors outline-none",
                            "focus-visible:ring-2 focus-visible:ring-line-strong/40",
                            isDisabled && "cursor-not-allowed opacity-50",
                            isInvalid && "border-red-500/60",
                            isFocusVisible && "border-zinc-500",
                            triggerSizes[size],
                            triggerClassName,
                        )
                    }
                >
                    <span className="min-w-0 flex-1 truncate">
                        {hasSelection ? (
                            <span className="flex items-center gap-1.5">
                                <span className="truncate font-medium">
                                    {selectedCountFormatter ? selectedCountFormatter(selectedCount) : `${selectedCount} selected`}
                                </span>
                                {supportingText ? <span className="truncate text-muted">{supportingText}</span> : null}
                            </span>
                        ) : (
                            <span className="text-muted">{placeholder}</span>
                        )}
                    </span>
                    <IoChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
                </AriaButton>

                <AriaPopover
                    placement="bottom"
                    offset={6}
                    triggerRef={triggerRef}
                    className={({ isEntering, isExiting }) =>
                        cx(
                            "overflow-hidden rounded-xl border border-line/80 bg-surface/95 shadow-xl backdrop-blur-sm outline-none",
                            isEntering && "duration-150 ease-out animate-in fade-in placement-top:slide-in-from-bottom-1 placement-bottom:slide-in-from-top-1",
                            isExiting && "duration-100 ease-in animate-out fade-out placement-top:slide-out-to-bottom-1 placement-bottom:slide-out-to-top-1",
                            popoverClassName,
                        )
                    }
                >
                    <AriaDialog className="outline-none">
                        <AriaAutocomplete filter={contains} inputValue={searchValue} onInputChange={setSearchValue}>
                            {showSearch ? (
                                <div className="border-b border-line/80">
                                    <AriaSearchField aria-label="Search options" value={searchValue} onChange={setSearchValue} autoFocus>
                                        <div className={cx("flex items-center gap-2", searchSizes[size])}>
                                            <IoSearch className="size-4 shrink-0 text-muted" aria-hidden />
                                            <AriaInput
                                                placeholder="Search"
                                                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                                            />
                                        </div>
                                    </AriaSearchField>
                                </div>
                            ) : null}

                            <AriaListBox
                                aria-label={label || "Options"}
                                items={items}
                                selectionMode="multiple"
                                selectedKeys={resolvedSelectedKeys}
                                onSelectionChange={handleSelectionChange}
                                renderEmptyState={() => (
                                    <MultiSelectEmptyState
                                        title={emptyStateTitle}
                                        description={emptyStateDescription}
                                        onClearSearch={searchValue ? () => setSearchValue("") : undefined}
                                    />
                                )}
                                className={cx("overflow-y-auto py-1 outline-none", popoverMaxHeights[size])}
                            >
                                {renderChildren}
                            </AriaListBox>
                        </AriaAutocomplete>

                        {showFooter ? <MultiSelectFooter size={size} onReset={handleReset} onSelectAll={handleSelectAll} /> : null}
                    </AriaDialog>
                </AriaPopover>
            </AriaDialogTrigger>

            {hint ? (
                <HintText isInvalid={isInvalid} className={cx(size === "sm" && "text-xs")}>
                    {hint}
                </HintText>
            ) : null}
        </div>
    );
};

const MultiSelect = MultiSelectRoot as typeof MultiSelectRoot & {
    Item: typeof MultiSelectItem;
    Footer: typeof MultiSelectFooter;
    EmptyState: typeof MultiSelectEmptyState;
};

MultiSelect.Item = MultiSelectItem;
MultiSelect.Footer = MultiSelectFooter;
MultiSelect.EmptyState = MultiSelectEmptyState;

export { MultiSelect };
