import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSettingsStore, COLOR_SCHEMES } from "@/lib/stores/settings-store";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";


interface ColorSchemeSwitcherProps {
    className?: string;
}

export function ColorSchemeSwitcher({ className }: ColorSchemeSwitcherProps) {
    const { t } = useTranslation();
    const { colorScheme, setColorScheme } = useSettingsStore();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("size-9", className)}
                    aria-label={t("ui.settings.colorScheme")}
                >
                    <Palette className="size-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuRadioGroup
                    value={colorScheme}
                    onValueChange={(value) => {
                        const selectedScheme = COLOR_SCHEMES.find((scheme) => scheme.value === value);
                        if (!selectedScheme) return;

                        setColorScheme(selectedScheme.value);
                        toast.success(t("ui.settings.colorSchemeSwitched", { scheme: t(selectedScheme.label) }));
                    }}
                >
                    {COLOR_SCHEMES.map((scheme) => (
                        <DropdownMenuRadioItem key={scheme.value} value={scheme.value} className="rounded-lg cursor-pointer">
                            <span className="mr-2 flex h-2 w-2 rounded-full" style={{ backgroundColor: scheme.color }} />
                            {t(scheme.label)}
                            {colorScheme === scheme.value && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
