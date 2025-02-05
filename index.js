const fs = require('fs');
const path = require('path');

module.exports = function DungeonMaster(mod) {
    let isRegistering = false
    let listName = 'default'
    let isLeaderRequested = false
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
        add: registerDungeons, // add [listName] - add dungeons to the list
        cancel: cancelRegisterDungeons, // cancel - cancel adding process
        run: runDungeons, // run [listName] - run matchmaking for dungeons from the list
        roll: rollDungeons, // roll [listName] [count] - run matchmaking for random dungeons from the list
        roles: checkRoles, // roles - check assigned roles for party members
        list: showLists, // show all lists
        save: saveToFile, // save - save all lists to the file
        load: loadFromFile // load - load all lists from the file
    })

    mod.hook('C_ADD_INTER_PARTY_MATCH_POOL', 2, event => {
        if (isRegistering && event.type === 0) {
            isLeaderRequested = event.preferredLeader === 1
            dungeons[listName] = Array.from(event.instances, (inst) => inst.id)
            mod.command.message(`Dungeons added: ${dungeons[listName].length}.`)
            isRegistering = false
            listName = 'default'
            return false
        }
    })

    function printHelp() {
        mod.command.message(`Commands:
<FONT COLOR="#FFFFFF">add [listName]</FONT> = Add dungeons in a list. You can specify the list name.
<FONT COLOR="#FFFFFF">cancel</FONT> = Cancel registering.
<FONT COLOR="#FFFFFF">run [listName]</FONT> = Run matchmaking for dungeons from the list.
<FONT COLOR="#FFFFFF">roll [listName] [count]</FONT> = Run matchmaking for random dungeons from the list.
<FONT COLOR="#FFFFFF">save</FONT> = Save all lists to the file.
<FONT COLOR="#FFFFFF">load</FONT> = Load all lists from the file.
<FONT COLOR="#FFFFFF">list</FONT> = Show all lists.
<FONT COLOR="#FFFFFF">roles</FONT> = Check assigned roles for party members.`)
    }

    function registerDungeons(...args) {
        let name = args.length > 0 ? args[0] : 'default'
        if (!isRegistering || name !== listName) {
            isRegistering = true
            listName = name
            mod.command.message('Registering started. Now request some dungeons you want to register.')
        }
        else {
            mod.command.message('Registering has already been started.')
        }
    }

    function cancelRegisterDungeons() {
        if (isRegistering) {
            isRegistering = false
            listName = 'default'
            mod.command.message('Registering cancelled.')
        }
        else {
            mod.command.message('Registering has not been started yet.')
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
            if (parseInt(args[0]) !== NaN) {
                count = parseInt(args[0])

                if (args[1] != undefined) {
                    dgs = dungeons[args[1]]
                }
            }
            else {
                dgs = dungeons[args[0]]

                if (args[1] != undefined && parseInt(args[1]) !== NaN) {
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
            preferredLeader: isLeaderRequested,
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
                mod.command.message('Wrong party composition')
                return
            }
        }
        
        mod.command.message(players.map(p => `${p.name}[${roleNames[p.role]}]`).join(', '))
    }

    function showLists() {
        mod.command.message('Lists: ', Object.keys(dungeons).map(k => `\n${k} - ${dungeons[k].length} dungeons`))
    }

    function saveToFile() {
        fs.writeFileSync(saveFilePath, JSON.stringify(dungeons), (err) => {
            if (err) {
                mod.command.message('Could not save the file.', err)
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
                    mod.command.message('Could not load the file.', err)
                }
                return
            }

            fs.readFile(saveFilePath, 'utf8', (err, data) => {
                if (err) {
                    if (isUser) {
                        mod.command.message('Could not load the file', err)
                    }
                    return
                }
                dungeons = JSON.parse(data);
                mod.command.message(`Loaded lists: ${Object.keys(dungeons).join(', ')}.`)
            });
        })
    }
}