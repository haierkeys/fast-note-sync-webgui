import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { VaultType } from "@/lib/types/vault";
import { useEffect, useState } from "react";

import { SettingList } from "./setting-list";


interface SettingManagerProps {
    vault: string;
    onVaultChange: (vault: string) => void;
    onNavigateToVaults: () => void;
}

export function SettingManager({ vault, onVaultChange }: SettingManagerProps) {
    const { handleVaultList } = useVaultHandle();
    const [vaults, setVaults] = useState<VaultType[]>([]);

    useEffect(() => {
        handleVaultList((data) => {
            setVaults(data);
        });
    }, [handleVaultList]);

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingList
                vault={vault}
                vaults={vaults}
                onVaultChange={onVaultChange}
            />
        </div>
    );
}
