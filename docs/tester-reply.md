# Copy-paste reply to the tester

---

Great questions — thanks for asking them.

**Where's the data hosted?**

On Supabase, which is a managed database service running on Amazon's servers.
The app itself runs on Vercel. Both are the same infrastructure used by a lot
of banking and health apps. There's no Amazon data centre in Nigeria, so the
data sits in their nearest region abroad.

**Is it encrypted?**

Yes, in three ways:

1. **Travelling to and from your phone** — everything moves over HTTPS, the
   same padlock encryption your bank app uses. Nobody on the WiFi or the
   mobile network can read it.
2. **Sitting in the database** — the whole database is encrypted on disk with
   AES-256.
3. **Your personal details specifically** — your name, phone number and your
   next of kin's contact are separately scrambled *before* they're saved.
   Even someone looking directly at the database sees something like
   `v1:vBjzZWB/qRc0pGjP:jIDAT0T9...` instead of your name. They're only
   unscrambled at the moment the app needs them — to show you your profile,
   or to email your next of kin if you press SOS.

Your password is never stored at all — only a one-way scrambled version, so
nobody can read it, including me.

**Who can see your location?**

Only people you give your Tracking ID to, plus the coordinators monitoring
journeys. Your tracking link stops working 24 hours after you arrive. And the
tracker page only ever shows your **first name** — not your phone number, not
your next of kin's number.

Your GPS is recorded **only while a trip is running** — never in the
background, never before you tap START JOURNEY, never after you arrive.

**One honest note:** this is a pilot, so please use a spare email and treat
anything you enter as test data. If you'd rather not use your real next of
kin's email for the SOS test, use a second address of your own — the alert
works exactly the same.

---

### Shorter version (WhatsApp-length)

> Good questions 👍
>
> Hosted on Supabase — managed database on Amazon's servers (same setup a lot
> of fintech apps use). The app runs on Vercel.
>
> And yes, encrypted three ways: HTTPS in transit (the padlock, same as your
> bank app), AES-256 on the disk, and your personal details — name, phone,
> next of kin — are separately scrambled before saving, so even looking
> straight at the database shows gibberish instead of your name. They're only
> unscrambled when the app needs them, like emailing your next of kin on SOS.
> Passwords are never stored in readable form at all.
>
> Location-wise: only people with your Tracking ID can follow you, the link
> expires 24h after you arrive, and the page only shows your first name — no
> phone numbers. GPS only records while a trip is active.
>
> It's still a pilot though, so use a spare email and treat it as test data 🙏
