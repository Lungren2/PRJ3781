import { useEffect, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
} from "lucide-react";
import { useToast } from "../components/ToastContext.jsx";
import { useAuth } from "../components/AuthContext.jsx";

const STATUSES = ["Open", "In Progress", "Completed"];

const APPLICANT_STATUS_LABELS = {
  applied: "Applied",
  selected: "Selected",
  completed: "Completed (shows on portfolio)",
  declined: "Declined",
};

const APPLICATION_STATUS_TEXT = {
  applied: "You applied. The organisation will be in touch if you are selected.",
  selected: "You were selected for this project.",
  declined: "This organisation went with other applicants.",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "No deadline";
}

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, apiFetch } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/product-requests/${id}`)
      .then((data) => { if (active) setProject(data); })
      .catch((error) => {
        if (active && error.status !== 404) toast(`Could not load project: ${error.message}`);
        if (active) setProject(null);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Reload when the project or the logged-in account changes.
  }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(action, successMessage) {
    setBusy(true);
    try {
      const updated = await action();
      if (updated) setProject(updated);
      if (successMessage) toast(successMessage);
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  }

  const apply = () =>
    run(
      () => apiFetch(`/api/product-requests/${id}/apply`, { method: "POST" }),
      "Application submitted successfully.",
    );

  const withdraw = () =>
    run(
      () => apiFetch(`/api/product-requests/${id}/apply`, { method: "DELETE" }),
      "Your application was withdrawn.",
    );

  const changeStatus = (status) =>
    run(
      () =>
        apiFetch(`/api/product-requests/${id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        }),
      `Status changed to ${status}.`,
    );

  const changeApplicantStatus = (userId, status) =>
    run(
      () =>
        apiFetch(`/api/organizations/${project.organizationId}/product-requests/${id}/applicants/${userId}`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        }),
      status === "completed" ? "Marked as completed. It now shows on their portfolio." : "Applicant updated.",
    );

  async function remove() {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/product-requests/${id}`, { method: "DELETE" });
      toast("Project request deleted.");
      navigate("/projects");
    } catch (error) {
      toast(`Could not delete: ${error.message}`);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="product-page loading-page">
        <div className="morrow-loader"></div>
        <p className="loading-text">Loading project...</p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="product-page">
        <div className="page-container">
          <p>Project not found.</p>
          <Link to="/projects" className="text-action back-link">
            <ArrowLeft size={16} />
            Back to Projects
          </Link>
        </div>
      </main>
    );
  }

  const { viewer } = project;
  const applicantLabel = `${project.applicantCount} student${project.applicantCount !== 1 ? "s" : ""} applied`;

  let applyAction = null;
  if (!user) {
    applyAction = (
      <Link
        className="button button--dark"
        to="/auth?mode=login"
        state={{ from: location.pathname }}
      >
        Log in to apply
      </Link>
    );
  } else if (!user.emailVerified) {
    applyAction = <Link className="button button--dark" to="/account" state={{ from: location.pathname }}>Verify your email to apply</Link>;
  } else if (viewer.canApply && viewer.applicationStatus === "completed") {
    applyAction = (
      <Link className="button button--dark" to="/portfolio-builder">
        Completed ✓ - See it on your portfolio
      </Link>
    );
  } else if (viewer.canApply && viewer.hasApplied) {
    applyAction = (
      <div className="project-application-state">
        <span>{APPLICATION_STATUS_TEXT[viewer.applicationStatus] ?? APPLICATION_STATUS_TEXT.applied}</span>
        <button className="button button--outline" type="button" onClick={withdraw} disabled={busy}>
          {busy ? "Withdrawing..." : "Withdraw application"}
        </button>
      </div>
    );
  } else if (viewer.canApply) {
    applyAction = (
      <button
        className={`button ${project.applicationsOpen ? "button--dark" : "button--outline"}`}
        type="button"
        onClick={apply}
        disabled={busy || !project.applicationsOpen}
      >
        {!project.applicationsOpen ? "Applications Closed" : busy ? "Applying..." : "Apply to Project"}
      </button>
    );
  }

  return (
    <main id="main-content" className="product-page">
      <section className="project-hero">
        <div className="page-container">
          <Link to="/projects" className="text-action back-link">
            <ArrowLeft size={16} />
            Back to Projects
          </Link>

          <p className="eyebrow">{project.companyName}</p>
          <h1>{project.title}</h1>

          <div className="project-row__meta hero-meta">
            <span>
              <BriefcaseBusiness size={15} />
              {project.department}
            </span>

            <span>
              <Clock3 size={15} />
              {project.category}
            </span>

            <span>
              <CalendarDays size={15} />
              {formatDate(project.deadline)}
            </span>
          </div>
        </div>
      </section>

      <section className="page-container project-detail-section">
        <div className="project-detail-card">
          <h2>Project Overview</h2>

          <p className="project-description">{project.description}</p>

          <hr className="project-divider" />

          <div className="project-info-grid">
            <div className="info-card">
              <span className="deadline-label">Payment</span>
              <strong>{project.pay || "Unpaid"}</strong>
            </div>

            {project.duration && (
              <div className="info-card">
                <span className="deadline-label">Expected duration</span>
                <strong>{project.duration}</strong>
              </div>
            )}

            <div className="info-card">
              <span className="deadline-label">Application deadline</span>
              <strong>{formatDate(project.deadline)}</strong>
            </div>

            <div className="info-card">
              <span className="deadline-label">Status</span>
              {viewer.canManage ? (
                <select
                  aria-label="Project status"
                  value={project.status}
                  onChange={(event) => changeStatus(event.target.value)}
                  disabled={busy}
                >
                  {STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              ) : (
                <strong>{project.status}</strong>
              )}
            </div>

            <div className="info-card">
              <span className="deadline-label">Applicants</span>
              <strong>{project.applicantCount}</strong>
            </div>
          </div>

          {project.applicants && (
            <div className="applications-panel">
              <div className="applications-panel__header">
                <div>
                  <h3>Applications</h3>
                  <p>{applicantLabel}. Only your organisation can see this list.</p>
                </div>
              </div>

              {project.applicants.length > 0 ? (
                <div className="applicant-list">
                  {project.applicants.map((applicant) => (
                    <div className="applicant-row" key={applicant.id}>
                      <div className="applicant-avatar">{applicant.name.charAt(0).toUpperCase()}</div>

                      <div className="applicant-info">
                        <strong>{applicant.name}</strong>
                        <span>
                          <a href={`mailto:${applicant.email}`}>{applicant.email}</a>
                          {" · applied "}
                          {new Date(applicant.appliedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {viewer.canManage ? (
                        <label className="compact-select">
                          <span className="sr-only">Status for {applicant.name}</span>
                          <select
                            value={applicant.status}
                            disabled={busy}
                            onChange={(event) => changeApplicantStatus(applicant.id, event.target.value)}
                          >
                            {Object.entries(APPLICANT_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span className="applicant-status">{APPLICANT_STATUS_LABELS[applicant.status]}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-applications">No applications yet.</p>
              )}
            </div>
          )}

          <div className="project-footer">
            {viewer.canManage && (
              <button className="button button--outline" type="button" onClick={remove} disabled={busy}>
                Delete request
              </button>
            )}
            {applyAction}
          </div>
        </div>
      </section>
    </main>
  );
}
