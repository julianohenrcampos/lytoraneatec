
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Selecione uma opção",
  emptyText = "Nenhuma opção encontrada",
  searchPlaceholder = "Buscar...",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  
  const selectedItem = React.useMemo(() => {
    return options.find((option) => option.value === value);
  }, [options, value]);

  // Filter options based on input value
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options;
    return options.filter((option) => 
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [options, inputValue]);

  const handleSelect = React.useCallback((selectedValue: string) => {
    console.log("🎯 Combobox item selected:", selectedValue);
    
    if (!selectedValue) {
      console.warn("⚠️ Empty value selected");
      return;
    }
    
    // Chamar onChange imediatamente sem delay
    onChange(selectedValue);
    setInputValue("");
    setOpen(false);
    console.log("✅ Combobox closed");
  }, [onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedItem ? selectedItem.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[10000] bg-popover text-popover-foreground shadow-xl border pointer-events-auto" 
        align="start"
        side="bottom"
        avoidCollisions={false}
        sideOffset={4}
        style={{ minWidth: '300px' }}
      >
        <Command shouldFilter={false} className="pointer-events-auto">
          <div className="flex items-center border-b px-3 pointer-events-auto">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
            <CommandInput 
              placeholder={searchPlaceholder} 
              value={inputValue}
              onValueChange={setInputValue}
              className="h-9 flex-1"
            />
          </div>
          <CommandList 
            className="max-h-[300px] overflow-y-auto"
            style={{ pointerEvents: 'auto' }}
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={(currentValue) => {
                  console.log("🖱️ CommandItem onSelect:", currentValue, option.label);
                  handleSelect(option.value);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("🖱️ CommandItem onClick:", option.value, option.label);
                  handleSelect(option.value);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground py-2.5 px-3 select-none"
                style={{ pointerEvents: 'auto' }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0 pointer-events-none",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="flex-1 pointer-events-none">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
