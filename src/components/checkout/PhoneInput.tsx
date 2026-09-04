import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { getPhoneCountryOptions } from '@/lib/phoneCountries';

interface PhoneInputProps {
  country: CountryCode;
  number: string;
  onCountryChange: (country: CountryCode) => void;
  onNumberChange: (number: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
}

/** Country-code dropdown (searchable) + national-number input, styled to match the rest of the form. */
export function PhoneInput({
  country,
  number,
  onCountryChange,
  onNumberChange,
  onBlur,
  placeholder,
  invalid,
  id,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => getPhoneCountryOptions(), []);
  const selected = options.find((c) => c.code === country) ?? options[0];

  return (
    <div className="flex gap-2 mt-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-[112px] shrink-0 justify-between px-2 font-normal"
          >
            <span className="truncate">
              {selected.flag} {selected.dial}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command
            filter={(value, search) => {
              const opt = options.find((c) => c.code === value);
              if (!opt) return 0;
              const haystack = `${opt.name} ${opt.dial} ${opt.code}`.toLowerCase();
              return haystack.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.code}
                    value={option.code}
                    onSelect={() => {
                      onCountryChange(option.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        option.code === country ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="mr-2">{option.flag}</span>
                    <span className="flex-1 truncate">{option.name}</span>
                    <span className="text-muted-foreground">{option.dial}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn('flex-1', invalid && 'border-red-500 focus-visible:ring-red-500')}
      />
    </div>
  );
}
