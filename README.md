# Classic Monopoly

A desktop board game for Windows. Play offline against the computer, or deal a table for people on the same Wi-Fi. No accounts and no internet connection are required.

## Run

Current build:

```text
release-build\win-unpacked\Classic Monopoly.exe
```

Installer:

```text
release-build\Classic Monopoly Setup 1.0.0.exe
```

The installer is not signed. If Windows SmartScreen appears, choose More info, then Run anyway.

From the project folder while developing:

```powershell
npm install
npm run dev
```

Rebuild the Windows installer:

```powershell
npm run dist
```

## Play

The main menu has three paths.

- **Solo Game** deals a match against 1–5 computer opponents. Choose difficulty, personality, your name, and your token.
- **Multiplayer LAN** hosts a table on this computer or joins one. Friends use the same Wi-Fi, then the host IP, port, and room code. A spectator can watch and use table talk without taking a seat.
- **Settings** keeps your name, token, language, theme, dice, table light, and turn pace.

Solo games save themselves. Open **Saved games** to resume. The host keeps the LAN game. If the host quits, the table closes.

## Table modes

- **Classic** uses the traditional prices, auctions, and last player standing.
- **Short Match** pays double for landing on GO and ends after 40 turns. The richest player wins.
- **Speed** charges half price for houses and hotels and ends after 28 turns.
- **Tycoon** starts with more cash, a higher salary, and a Free Parking pot.
- **Friendly** skips auctions and uses lighter taxes.
- **Cutthroat** starts with less cash, flat taxes, and a 48-turn clock.

Auctions are open. Anyone who has not passed may bid, and each bid resets a 20-second clock.

## Companies

The person who deals the table can place or remove firms on the squares. Solo setup and the LAN host lobby both include the company editor. After the match starts, that same person can open **Edit companies**. Removing a firm restores the classic deed on that square. The price, rent, and color stay with the square.

## Turn pace

Settings includes five speeds. **Slow** and **Leisurely** move tokens more gradually and leave a pause between computer actions. A Chance or Community Chest card stays on the table until you press **OK**, or until its timer ends. Enter and Escape also close that card.

## Language and look

Settings can switch the table controls and cards between English and Russian. Themes, ivory or ebony or wood dice, and day or night light are saved on this computer.
