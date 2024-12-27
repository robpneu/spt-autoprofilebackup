import fs from "node:fs";
import type { DependencyContainer } from "tsyringe";
import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import type { IPostSptLoadMod } from "@spt/models/external/IPostSptLoadMod";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { ICoreConfig } from "@spt/models/spt/config/ICoreConfig";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import { LogBackgroundColor } from "@spt/models/spt/logging/LogBackgroundColor";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";
import type { VFS } from "@spt/utils/VFS";
import type { ModConfig } from "./interface";

import { jsonc } from "jsonc";

import path from "node:path";
import type { Watermark } from "@spt/utils/Watermark";

import pkg from "../package.json";

export class Mod implements IPreSptLoadMod, IPostDBLoadMod, IPostSptLoadMod 
{
    readonly modName = `${pkg.author}-${pkg.name}`;
    private modConfig: ModConfig;
    private logger: ILogger;
    private vfs: VFS;
    protected sptVersion: string;
    protected configServer: ConfigServer;
    protected jsonUtil: JsonUtil;
    protected saveServer: SaveServer;

    public preSptLoad(container: DependencyContainer) : void 
    {
        const staticRouterModService: StaticRouterModService =
      container.resolve<StaticRouterModService>("StaticRouterModService");

        // get logger
        this.logger = container.resolve<ILogger>("WinstonLogger");

        // Get VFS to read in configs
        this.vfs = container.resolve<VFS>("VFS");

        // Read in the json c config content and parse it into json
        this.modConfig = jsonc.parse(this.vfs.readFile(path.resolve(__dirname, "../config/config.jsonc")));

        if (!this.modConfig.Enabled) 
        {
            return;
        }

        if (this.modConfig?.AutoBackup?.OnGameStart) 
        {
            staticRouterModService.registerStaticRouter(
                `${this.modName}-/client/game/start`,
                [
                    {
                        url: "/client/game/start",
                        action: async (url, info, sessionId, output) : Promise<string> =>
                        {
                            this.onEvent("onGameStart", sessionId);
                            return output;
                        }
                    }
                ],
                "spt"
            );
        }

        if (this.modConfig?.AutoBackup?.OnRaidStart) 
        {
            staticRouterModService.registerStaticRouter(
                `${this.modName}-/client/match/local/start`,
                [
                    {
                        url: "/client/match/local/start",
                        action: async (url, info, sessionId, output) : Promise<string> =>
                        {
                            this.onEvent("onRaidStart", sessionId);
                            return output;
                        }
                    }
                ],
                "spt"
            );
        }

        if (this.modConfig?.AutoBackup?.OnRaidEnd) 
        {
            staticRouterModService.registerStaticRouter(
                `${this.modName}-/client/match/local/end`,
                [
                    {
                        url: "/client/match/local/end",
                        action: async (url, info, sessionId, output) : Promise<string> =>
                        {
                            this.onEvent("onRaidEnd", sessionId);
                            return output;
                        }
                    }
                ],
                "spt"
            );
        }

        if (this.modConfig?.AutoBackup?.OnLogout) 
        {
            staticRouterModService.registerStaticRouter(
                `${this.modName}-/client/game/logout`,
                [
                    {
                        url: "/client/game/logout",
                        action: async (url, info, sessionId, output) : Promise<string> =>
                        {
                            this.onEvent("onLogout", sessionId);
                            return output;
                        }
                    }
                ],
                "spt"
            );
        }
    }

    public postSptLoad(container: DependencyContainer): void 
    {
        if (!this.modConfig.Enabled) 
        {
            return;
        }

        this.configServer = container.resolve<ConfigServer>("ConfigServer");
        this.jsonUtil = container.resolve<JsonUtil>("JsonUtil");
        this.saveServer = container.resolve<SaveServer>("SaveServer");

        for (const profileKey in this.saveServer.getProfiles()) 
        {
            const sessionID = this.saveServer.getProfile(profileKey).info.id;
            if (sessionID !== profileKey) 
            {
                this.saveServer.deleteProfileById(profileKey);
                fs.rename(
                    `${this.saveServer.profileFilepath}/${profileKey}.json`,
                    `${this.saveServer.profileFilepath}/${sessionID}.json`,
                    () => 
                    {
                        this.saveServer.loadProfile(sessionID);
                    }
                );
                this.logger.info(
                    `${this.modName}: Profile "${profileKey}.json" => "${sessionID}.json" name fixed`
                );
            }
        }
    }

    public postDBLoad(container: DependencyContainer): void 
    {
        this.logger = container.resolve<ILogger>("WinstonLogger");
        this.logger.info(
            `Loading: ${this.modName} ${pkg.version}${
                this.modConfig.Enabled ? "" : " [Disabled]"
            }`
        );
        if (!this.modConfig.Enabled) 
        {
            return;
        }

        this.vfs = container.resolve<VFS>("VFS");
        this.sptVersion = container.resolve<Watermark>("Watermark").getVersionTag();
    }

    public onEvent(event: string, sessionID: string) : void
    {
        const sessionPath = `${this.saveServer.profileFilepath}/AutoBackup/${this.sptVersion}/${sessionID}/`;

        if (!this.vfs.exists(sessionPath)) 
        {
            this.logger.success(`${this.modName}: "${sessionPath}" has been created`);
            this.vfs.createDir(sessionPath);
        }

        if (this.modConfig?.MaximumBackupPerProfile >= 0) 
        {
            const profileList = this.vfs
                .getFilesOfType(sessionPath, "json")
                .sort((a, b) => fs.statSync(a).ctimeMs - fs.statSync(b).ctimeMs);
            let delCount = 0;
            let fileName = "";

            while (
                profileList.length &&
        profileList.length >= this.modConfig.MaximumBackupPerProfile
            ) 
            {
                const lastProfile = profileList[0];
                fileName = lastProfile.split("\\").pop();
                this.vfs.removeFile(lastProfile);
                profileList.splice(0, 1);
                delCount++;
            }

            if (this.modConfig?.MaximumBackupDeleteLog) 
            {
                if (delCount === 1) 
                {
                    this.logger.log(
                        `${this.modName} @ ${sessionID}: Maximum backup reached (${this.modConfig.MaximumBackupPerProfile}), Backup file "${fileName}" deleted`,
                        LogTextColor.RED,
                        LogBackgroundColor.DEFAULT
                    );
                }
                else if (delCount > 1) 
                {
                    this.logger.log(
                        `${this.modName} @ ${sessionID}: Maximum backup reached (${this.modConfig.MaximumBackupPerProfile}), Total "${delCount}" backup files deleted`,
                        LogTextColor.RED,
                        LogBackgroundColor.DEFAULT
                    );
                }
            }
        }

        const backupFileName = `${new Date().toISOString().replace(/[:.]/g, "")}-${event}.json`;

        const jsonProfile = this.jsonUtil.serialize(
            this.saveServer.getProfile(sessionID),
            !this.configServer.getConfig<ICoreConfig>(ConfigTypes.CORE).features.compressProfile
        );

        this.vfs.writeFile(`${sessionPath}${backupFileName}`, jsonProfile);

        if (this.modConfig?.BackupSavedLog) 
        {
            this.logger.log(
                `${this.modName} @ ${sessionID}: New backup file "${backupFileName}" saved`,
                LogTextColor.WHITE,
                LogBackgroundColor.MAGENTA
            );
        }
    }
}

module.exports = { mod: new Mod() };
