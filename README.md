# dungeon-master

The module allows you to save sets of dungeons to different lists and request them for matchmaking at anytime without manual selection.

You can also request a random dungeon(s) if you don't know what to choose.

## Warning

The module automatically assigns roles for party members according to their default roles and tries to resolve conflicts to fit standard matchmaking rules. It is not possible to change roles for party members manually.

E.g. party of **[Lancer, Warrior, Brawler]** will be resolved to **[Tank, Dmg, Dmg]**, whereas **[Warrior, Brawler]** will be resolved to **[Dmg, Tank]**.

## Usage

Commands start with `dungeonmaster` or `dm`.

Parameters:

- `add [listName]` - Add dungeons to the list. You can specify the list name. Otherwise, `'default'` list is used. Once you entered this command, open dungeons window, select dungeons you want to add, and start a matchmaking manually to finish the recording.
- `cancel` - Cancel recording.
- `run [listName]` - Start a matchmaking for dungeons from the list. You can specify the list name.
- `roll [listName] [count]` - Start a matchmaking for a random dungeon(s) from the list. You can specify the list name and/or dungeon count.
- `leader <1|0>` - Set / unset you as a party leader for the matchmaking.
- `save` - Save all lists to the file.
- `load` - Load all lists from the file.
- `list` - Show all lists.
- `roles` - Check the assigned roles for party members.
