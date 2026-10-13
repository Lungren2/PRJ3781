# Auth work for the demo

This review includes upstream main through 9816ab0, including the backend work in 49d1cdb. Signup, login, server sessions, CSRF checks, candidate access and company membership checks are already working. All 41 server tests passed before this work started.

This first PR will cover three gaps:

- Anyone can sign up as a company and immediately browse candidates and download their CVs. Companies need approval before they get directory access. Candidates will still share their CV with a company when they apply for one of its jobs or projects.
- Adding spaces around an email gets around the login limit. The limit also combines the email and IP in one counter, so changing either gives a fresh allowance.
- An expired session leaves the page looking signed in. Logging out after expiry can fail before the page clears the old login state.

There is more to do after this PR:

- Verify email addresses and add password reset and password change.
- Add company invitations, member removal, role changes and ownership transfer. Owner, recruiter and viewer checks exist, but there is no way to manage those memberships through the app.
- Add a company selector. The backend supports several memberships, but the employer pages use the first company.
- Decide whether admin and department accounts belong in the demo. They exist in the user model but have no working permissions or screens.
- Add a way to disable and restore accounts. The backend already rejects sessions for disabled users.
- Record important events such as login failures, company approval, member changes and CV downloads.
- Set up and check the hosted API with HTTPS, secure cookies, allowed origins and the right proxy settings. The current Compose setup runs the development API.
- Use a shared login-limit store before running several API instances.
- Expand the tests for roles, revoked access, login limits and expired sessions in the browser.
- Remove jobCrawler.env from Git tracking and the Docker build context. The latest commit added it to .gitignore, but the file is still tracked. Rotate any live key it contains.

MFA and SSO can wait for a controlled demo unless they are part of the agreed requirements. Use made-up candidate data until the public access and hosting checks are complete.
