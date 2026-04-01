# Paper Runtime Snapshot

Plik `paper-runtime-snapshot.json` to zrzut danych testowych z Twojej bazy:
- strategii,
- konfiguracji bota,
- powiazan bot<->rynki<->strategie,
- otwartych pozycji.

## Eksport aktualnego stanu

```bash
pnpm --filter api run snapshot:paper:export
```

Opcjonalnie:
- `SNAPSHOT_EMAIL` - email usera do eksportu (domyslnie `wroblewskipatryk@gmail.com`)
- `SNAPSHOT_OUTPUT` - sciezka pliku wyjsciowego

## Import po resecie bazy

```bash
pnpm --filter api run snapshot:paper:import
```

Opcjonalnie:
- `SNAPSHOT_INPUT` - sciezka pliku snapshot
- `SNAPSHOT_USER_PASSWORD` - haslo tworzonego usera, gdy nie istnieje

Rekomendowana kolejnosc po `prisma migrate reset`:
1. standardowy seed (`pnpm --filter api exec prisma db seed`)
2. import snapshotu (`pnpm --filter api run snapshot:paper:import`)
