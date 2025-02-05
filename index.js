const fs = require('fs');
const path = require('path');

module.exports = function DungeonMaster(mod) {
    let isRegistering = false
    let listName = 'default'
    let isLeader = false
    let dungeons = { default: [] }
    let party = []
    const defaultRoles = {
        0: [1,0],
        1: [0],
        2: [1],
        3: [1], // sorry for Berserkers but no tank for you
        4: [1],
        5: [1],
        6: [2],
        7: [2],
        8: [1],
        9: [1],
        10: [0,1],
        11: [1],
        12: [1],
    }
    const roleNames = ['tank', 'dmg', 'heal']
    const saveFileName = 'favorites.json'
    const saveFilePath = path.join(mod.info.path, 'data', saveFileName)

    loadFromFile(false)

    mod.dispatch.addDefinition("C_ADD_INTER_PARTY_MATCH_POOL", 2, path.join(mod.info.path, "defs", "C_ADD_INTER_PARTY_MATCH_POOL.2.def"));
    mod.game.initialize('party')
    mod.game.party.on('list', (list) => party = list)

    mod.command.add(['dungeonmaster','dm'], {
        $default: printHelp,
        $none: printHelp,
        help: printHelp,
        add: registerDungeons, // add [listName]
        cancel: cancelRegisterDungeons, // cancel
        run: runDungeons, // run [listName]
        roll: rollDungeons, // roll [listName] [count]
        roles: checkRoles, // roles
        leader: setLeader, // leader <1|0>
        list: showLists, // list
        save: saveToFile, // save
        load: loadFromFile // load
    })

    mod.hook('C_ADD_INTER_PARTY_MATCH_POOL', 2, event => {
        if (isRegistering && event.type === 0) {
            //isLeaderRequested = event.preferredLeader === 1
            dungeons[listName] = Array.from(event.instances, (inst) => inst.id)
            mod.command.message(`Dungeons added: ${dungeons[listName].length}.`)
            isRegistering = false
            listName = 'default'
            return false
        }
    })

    function printHelp() {
        mod.command.message(`Commands:
<FONT COLOR="#FFFFFF">add [listName]</FONT> = Add dungeons to the list. You can specify the list name.
<FONT COLOR="#FFFFFF">cancel</FONT> = Cancel recording.
<FONT COLOR="#FFFFFF">run [listName]</FONT> = Start a matchmaking for dungeons from the list.
<FONT COLOR="#FFFFFF">roll [listName] [count]</FONT> = Start a matchmaking for a random dungeon(s) from the list. You can specify the list name and/or dungeon count.
<FONT COLOR="#FFFFFF">leader <1|0></FONT> = Set / unset you as a party leader.
<FONT COLOR="#FFFFFF">save</FONT> = Save all lists.
<FONT COLOR="#FFFFFF">load</FONT> = Load all lists.
<FONT COLOR="#FFFFFF">list</FONT> = Show all lists.
<FONT COLOR="#FFFFFF">roles</FONT> = Check the assigned roles for party members.`)
    }

    function registerDungeons(...args) {
        let name = args.length > 0 ? args[0] : 'default'
        if (!isRegistering || name !== listName) {
            isRegistering = true
            listName = name
            mod.command.message('Recording started. Open dungeons window, select dungeons you want to add, and start a matchmaking manually to finish the recording.')
        }
        else {
            mod.command.message('Recording has already been started.')
        }
    }

    function cancelRegisterDungeons() {
        if (isRegistering) {
            isRegistering = false
            listName = 'default'
            mod.command.message('Recording cancelled.')
        }
        else {
            mod.command.message('Recording has not been started yet.')
        }
    }

    function runDungeons(...args) {
        if (isRegistering) {
            cancelRegisterDungeons()
        }
        let dgs = args.length > 0 ? dungeons[args[0]] : dungeons.default

        if (validateDungeons(dgs)) {
            startMatching(dgs)
        }
    }

    function rollDungeons(...args) {
        if (isRegistering) {
            cancelRegisterDungeons()
        }
        let dgs = dungeons.default
        let count = 1
        if (args.length > 0) {
            if (!isNaN(parseInt(args[0]))) {
                count = parseInt(args[0])

                if (args[1] != undefined) {
                    dgs = dungeons[args[1]]
                }
            }
            else {
                dgs = dungeons[args[0]]

                if (args[1] != undefined && !isNaN(parseInt(args[1]))) {
                    count = parseInt(args[1])
                }
            }
        }

        if (validateDungeons(dgs)) {
            count = Math.min(count, dgs.length)
            const selected = dgs.sort(() => 0.5 - Math.random()).slice(0, count);
            startMatching(selected)
        }
    }

    function startMatching(instances) {
        let players = []
        if (!mod.game.party.inParty()) {
            players.push({
                id: mod.game.me.playerId,
                role: defaultRoles[getClassId(mod.game.me.templateId)][0]
            })
        }
        else if (party.length > 1) {
            const roles = getPartyRoles()

            if (party.length < 5 && roles != null) {
                let i = 0
                party.forEach(p => players.push({ id: p.playerId, role: roles[i++] }))
            }
            else {
                mod.command.message('Unable to request dungeon matching - wrong party composition.')
                return
            }
        }

        const packet = {
            preferredLeader: isLeader,
            type: 0,
            instances: instances.map(d => ({id: d})),
            players: players
        }

        // mod.command.message(packet.preferredLeader)
        // mod.command.message(packet.type)
        // mod.command.message(Array.from(packet.instances, (inst) => inst.id).join(' '))
        // mod.command.message(Array.from(packet.players, (p) => `${p.id} - ${p.role}`).join(' '))

        mod.send('C_ADD_INTER_PARTY_MATCH_POOL', 2, packet)
    }

    function getClassId(templateId) {
        return templateId % 100 - 1
    }

    function validateDungeons(dgs) {
        if (dgs == undefined || dgs.length === 0) {
            mod.command.message('Unable to request dungeon matching - no dungeons found in the list.')
            return false
        }
        return true
    }

    function getPartyRoles() {
        let classes = Array.from(party, p => p.class)

        // create all possible combinations of roles by classes
        let combs = generateRoleCombinations(classes)

        for (const roles of combs) {
            if (roles.filter(r => r === 0).length > 1 ||
                roles.filter(r => r === 2).length > 1 ||
                roles.filter(r => r === 1).length > 3)
                break

            return roles
        }
        return null
    }

    function generateRoleCombinations(classes) {
        if (classes.length === 0) return [[]];
    
        const [firstClass, ...restClasses] = classes;
        const roleCombinationsForRest = generateRoleCombinations(restClasses, defaultRoles);
        const roleCombinationsForFirst = defaultRoles[firstClass];
    
        const result = [];
        for (let role of roleCombinationsForFirst) {
            for (let combination of roleCombinationsForRest) {
                result.push([role, ...combination]);
            }
        }

        return result;
    }

    function setLeader(state) {
        if (state === '1') {
            isLeader = true
            mod.command.message('Party leader is enabled.')
        }
        else if (state === '0') {
            isLeader = false
            mod.command.message('Party leader is disabled.')
        }
    }
    
    function checkRoles() {
        let players = []
        if (!mod.game.party.inParty()) {
            players.push({
                name: mod.game.me.name,
                role: defaultRoles[getClassId(mod.game.me.templateId)][0]
            })
        }
        else if (party.length > 1) {
            const roles = getPartyRoles()
            if (party.length < 5 && roles != null) {
                let i = 0
                party.forEach(p => players.push({ name: p.name, role: roles[i++] }))
            }
            else {
                mod.command.message('Wrong party composition.')
                return
            }
        }
        
        mod.command.message(players.map(p => `${p.name}[${roleNames[p.role]}]`).join(', '))
    }

    function showLists() {
        mod.command.message('Lists: ' + Object.keys(dungeons).map(k => `${k}(${dungeons[k].length})`).join(', '))
    }

    function saveToFile() {
        fs.writeFile(saveFilePath, JSON.stringify(dungeons), (err) => {
            if (err) {
                mod.command.message('Could not save the file.' + err)
            }
            else {
                mod.command.message('Successfully saved.')
            }
        })
    }

    function loadFromFile(isUser = true) {
        fs.access(saveFilePath, fs.constants.F_OK | fs.constants.R_OK, (err) => {
            if (err) {
                if (isUser) {
                    mod.command.message('Could not load the file.' + err)
                }
                return
            }

            fs.readFile(saveFilePath, 'utf8', (err, data) => {
                if (err) {
                    if (isUser) {
                        mod.command.message('Could not load the file.' + err)
                    }
                    return
                }
                dungeons = JSON.parse(data);
                if (isUser) {
                    mod.command.message(`Loaded lists: ${Object.keys(dungeons).join(', ')}.`)
                }
            });
        })
    }
}