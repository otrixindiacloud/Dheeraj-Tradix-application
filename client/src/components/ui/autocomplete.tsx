import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface AutocompleteProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  suggestions: string[]
  className?: string
  disabled?: boolean
}

export function Autocomplete({
  value,
  onValueChange,
  placeholder = "Type to search...",
  suggestions,
  className,
  disabled = false,
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)

  // Filter suggestions based on input
  const filteredSuggestions = React.useMemo(() => {
    if (!inputValue) return suggestions
    return suggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase())
    )
  }, [suggestions, inputValue])

  // Update input value when external value changes
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue)
    onValueChange(selectedValue)
    setOpen(false)
  }

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue)
    onValueChange(newValue)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {inputValue || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            <CommandEmpty>No suggestions found.</CommandEmpty>
            <CommandGroup>
              {filteredSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  value={suggestion}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      inputValue === suggestion ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {suggestion}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
