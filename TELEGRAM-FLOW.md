# How it works in Telegram

## User must choose: job seeker or posting vacancy (HR)

When the user opens the app, the **home screen clearly shows what they can do** so they don’t get confused:

- **"I'm looking for a job"** — Vacancies, My resume, My applications, My matches. The user acts as a **candidate** (job seeker).
- **"I want to post a vacancy (HR)"** — My vacancies, Create vacancy, Opened resumes. The user acts as **employer** (HR).

The **role** (candidate / employer / admin) is set in WordPress for that user. The app shows the matching sections and labels so the user immediately sees whether they’re here to find a job or to upload a vacancy. Admin sees both sections.

So: the user **must** understand they either look for a job (resume, applications) or post vacancies (create vacancy, opened resumes). Role is assigned in WP: Users → edit user → Role. New Telegram users get Candidate by default.

## CV upload

CV upload is in the app: **My resume** → **Edit resume** (or Create resume). The form has **Attach CV (PDF, DOC)**; the file is uploaded and linked to your resume.

## Viewing full vacancy

**Vacancies** list has **View** on each row. **View** opens the **full vacancy** (title, skills, tags, **full description**). The description is shown as readable text (no raw WordPress block HTML). **You see the full description even for vacancies you already applied to** — so you can re-read the text; the only difference is the button shows "You applied" instead of "Respond".

## Opened resumes: when candidate has no resume

**Opened resumes** lists confirmed matches. The API now returns **candidate profile** (skills, tags, status) for each. So when you View a candidate: if they have a resume we show it + Download CV; if not we show their **Skills**, **Tags**, **Status** from profile. So you always see at least profile data.

## Tags and matches

- **Tags** (and skills) are used to **match** candidates with vacancies. The backend computes a **match_score**: the more overlap between vacancy tags/skills and candidate tags/skills, the higher the score.
- Admin **suggestions** (`GET /matches/suggestions`) are sorted by **match_score** (same or similar tags/skills = better match). So recommendations are based on tag/skill overlap.
- In the Mini App, "My matches" shows matches for the candidate; "Opened resumes" shows candidates for the employer. Matching is done in WordPress admin; the app displays the result.

---

## What does the user see in Telegram?

1. User finds your bot in Telegram (by name or link).
2. They tap the bot and see the **menu** (or a button like "Open app" / "Open Mini App").
3. They tap **Open app** → Telegram opens your Mini App in a built-in browser (full screen or bottom sheet, depending on client).
4. The app loads your frontend (this Mini App). The frontend reads **initData** from Telegram and sends it to your backend `POST /auth`.
5. Backend creates or finds the user, returns a **token**. The app then works as that user.

The **design** is the one you have now: welcome card with name, role badge, and menu cards (Vacancies, My resume, etc.). In Telegram the app uses Telegram theme colors (dark/light) if you use the CSS variables we added (`--tg-theme-*`).

---

## Candidate (соискатель)

**Who:** A person looking for a job. Usually they get the **candidate** role when they first open the app from Telegram (your backend assigns it on signup).

**What they can do in the Mini App:**

| Screen | Action |
|--------|--------|
| **Vacancies** | See the list of published vacancies. **Respond** button on each vacancy (one click = one application). Already applied show "Applied". |
| **My resume** | View their resume. **Edit resume** opens a form: title, about (text), attach CV file (PDF/DOC). Save creates or updates resume. **Delete resume** removes the resume (with confirmation). |
| **My applications** | See vacancies they applied to and the status (pending / viewed / matched). |
| **My matches** | See matches (vacancy + status). **Interested** / **Not interested** buttons to set reaction. |
| **Profile** | View profile (name, role, status, skills, tags). |

So the candidate: **browses vacancies → clicks Respond → sees applications and matches → can react to matches. Creates/edits resume with optional CV attachment.**

---

## Employer (работодатель)

**Who:** A company/recruiter. You assign the **employer** role to their WordPress user (in WP admin). They open the same Mini App from Telegram; the app shows different menu items for their role.

**What they can do in the Mini App:**

| Screen | Action |
|--------|--------|
| **My vacancies** | List of vacancies they own (company name + job title). Each has **View** and **Delete**. |
| **Pending my approval** | Matches that admin has approved (status "Pending employer"). Employer can **Approve** or **Reject**. After approval, the candidate sees the match in My matches. |
| **Opened resumes** | Resumes of candidates after the employer has **approved** the match (status = confirmed). Shows company and job title. |
| **Profile** | View profile and **Switch mode** (job seeker / posting vacancy). |

So the employer: **sees their vacancies and, for confirmed matches, the candidates' resumes.** Creating vacancies can be added later in the Mini App or done in WordPress admin.

---

## Admin

If an admin opens the app from Telegram (or you log in with a dev token for an admin user), they see **both** candidate and employer sections: Vacancies, My resume, My applications, My matches, My vacancies, Opened resumes, Profile. Admin-only actions (e.g. match suggestions, confirm/reject matches) are not in the Mini App yet — those stay in WordPress admin.

---

## Summary

- **Design:** Updated to cards, clear hierarchy, back button, Telegram theme support.
- **Dev login:** You see admin because the dev token is for the admin user; in production users see their own role.
- **In Telegram:** One app for everyone; the **role** (candidate / employer / admin) decides which menu items and data they see. Candidate: create/edit resume (with CV file), view vacancies and respond, view applications and matches and set reaction. Employer: create vacancy, my vacancies, pending approval, opened resumes, profile. Admin: all of the above; match management stays in WordPress web admin.

**Deploy and connect to Telegram:** Backend (WordPress) must be reachable over HTTPS. In BotFather set the Mini App URL to your frontend (e.g. Vercel). In frontend config set `API_BASE_URL` to your WordPress URL; leave `DEV_TOKEN` empty. Users open the bot and tap the Mini App; they are logged in automatically.
