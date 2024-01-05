import { CommandPermissionLevel } from "bdsx/bds/command";
import { MinecraftPacketIds } from "bdsx/bds/packetids";
import { DisconnectPacket, TextPacket } from "bdsx/bds/packets";
import { command } from "bdsx/command";
import { CANCEL } from "bdsx/common";
import { events } from "bdsx/event";
import { bedrockServer } from "bdsx/launcher";

let regex = /^((NO LOG FILE! - )|())(\[)\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])( )(?:[01]\d|2[0-3]):(?:[0-5]\d):(?:[0-5]\d)(:)[0-9]{1,5}( INFO\] ).{0,}$/;

const getPrefix = (service: string) => {
    const date = new Date();
    const time = ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2) + ":" + ("0" + date.getSeconds()).slice(-2);
    return `${time.cyan} [${service}]`;
};

/**
 * Better logging
 */

events.serverLog.on((log, color) => {
    if (log.includes("Running AutoCompaction")) return CANCEL;

    let message = log;
    if (regex.test(log)) {
        message = log.split("INFO] ")[1];
    }

    console.log(getPrefix("Server"), message);
    return CANCEL;
});

events.packetBefore(MinecraftPacketIds.Text).on((packet, netId, packetId) => {
    console.log(getPrefix("Chat"), `<${packet.name}> ${packet.message}`);
});

events.command.on((command, name, ctx) => {
    if (name == "Server") return;
    console.log(getPrefix("Command"), `<${name}> ${command}`);
});


/**
 * Restart
 */
events.serverOpen.on(() => {
    command.register("restart", "restart the server", CommandPermissionLevel.Operator).overload((param, origin, output) => {
        console.log("restart in 30 seconds");
        bedrockServer.executeCommand(`tellraw @a {"rawtext":[{"text":"§a§lРестарт через 30 секунд!"}]}`);
        setTimeout(() => {
            bedrockServer.level.getPlayers().forEach(pl => {
                const dp = DisconnectPacket.allocate();
                dp.skipMessage = false;
                dp.message = "Restart";
                dp.sendTo(pl.getNetworkIdentifier());
                dp.dispose();
            });
        }, 30000);
        setTimeout(() => bedrockServer.executeCommand("stop"), 37000);
    }, {});
});


const restartInterval = setInterval(() => {
    if (bedrockServer.isClosed()) {
        clearInterval(restartInterval);
        return;
    }

    const date = new Date();
    if (date.getHours() === 8 && date.getMinutes() === 30) {
        bedrockServer.executeCommand("restart");
    }
}, 60 * 1000);

/**
 * Scheduled message into the chat. 
 */
let messageSent = 0;
const announcementInterval = setInterval(() => {
    if (bedrockServer.isClosed()) {
        clearInterval(restartInterval);
        return;
    }

    const pkt = TextPacket.allocate();
    pkt.type = TextPacket.Types.Announcement;
    if (messageSent >= 4) {
        pkt.message = "§a§lИграя на сервере вы соглашаетесь с нашими правилами.";
        messageSent = 0;
    } else {
        pkt.message = "§a§lНаш сайт: §6far-lands.top";
        messageSent++;
    }
    for (const player of bedrockServer.level.getPlayers()) {
        player.sendNetworkPacket(pkt);
    }
    pkt.dispose();
}, 1000000);

events.serverClose.on(() => {
    clearInterval(restartInterval);
    clearInterval(announcementInterval);
});
