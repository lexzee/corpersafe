# 🛡️ CorperSafe — Tester Guide (PCMs)

**Test link:** https://corpersafe.vercel.app
**Use your phone** (the phone is the tracker) · Allow **Location** when asked · *Not affiliated with the NYSC Directorate.*

---

## What it is

- A **travel-safety app for corps members going to camp** — your phone becomes a live tracker for the journey.
- You register your trip, get a **Tracking ID** (e.g. `NYSC-8Q2K7M`), and send it to your parents.
- **Parents follow you on a live map with no account and no app** — they just open the link.
- If anything goes wrong, an **SOS button** emails your next of kin and flags you on the admin dashboard.
- State coordinators / school admins see every active trip on a **Mission Control** map and respond to alerts.

---

## How to test it (about 10 minutes)

**1. Create your account** — `/auth/sign-up`
- Email, full name, phone, **next of kin's phone + email**, password.
- Use a real next-of-kin email (yours or a friend's) — that's where the SOS lands.
- You'll be sent to login. Sign in → you land on your **Dashboard**.

**2. Register your trip** — tap *Start New Trip*
- **Origin:** tap the locate icon to auto-detect, or type it (e.g. "Jibowu Park, Lagos").
- **Destination:** pick your state — the camp is attached automatically.
- **Next of kin** is pre-filled from signup; **Institution:** pick your school.
- Tap **Start Journey** → the trip is created and you get your Tracking ID.

**3. Share your code before you move**
- On the *Trip Registered* screen, add the **vehicle plate number** (optional, helps responders).
- Tap **START JOURNEY** → tracking goes live and the map starts moving.
- On the tracking screen, tap **copy** or **share** on the Tracking ID and send it to whoever should follow you.

**4. Let someone track you** — `https://corpersafe.vercel.app/track`
- Open it in another browser/phone (**no login**), type the code, tap **Track**.
- They should see your live position, distance to camp, and plain English like *"Alex is on the move."*

**5. Try the journey controls** (walk or drive around a bit)
- **Report Stop** — pick a reason: Food, Traffic, Repair, Sleep, Checkpoint, Other. Parents see the reason.
- It also **auto-pauses** after ~5 min stopped and **auto-resumes** once you're moving again.
- **Arrived** — confirm, then an 8-second undo. This ends tracking and files the trip in **History**.

**6. Test the SOS** ⚠️ *(tell your next of kin first — a real email goes out)*
- **Press and hold SOS for 3 seconds** → you get a **5-second window to cancel**.
- After that: next of kin is emailed, your pin turns red on the admin map, and parents see *"…pressed the SOS button."*
- Tap **"I'm Safe — Cancel"** twice to clear a false alarm.

---

## Also worth poking at

- **Turn off data mid-trip** — GPS keeps recording and syncs when you're back online.
- **Lock/close the tab** — you'll be warned; the screen is meant to stay on and the tab open.
- **Install it** — "Add to Home Screen" works; it opens like a normal app.
- **History** and **Profile** — past trips with route replay, and editable next-of-kin details.

---

## Tell us afterwards

- Was anything **confusing or slow** — especially signup and trip registration?
- Did the map show **where you actually were**, and did your parent's view match it?
- Did the **SOS email arrive**, and how long did it take?
- Would you **actually use this** travelling to camp? What's missing?
