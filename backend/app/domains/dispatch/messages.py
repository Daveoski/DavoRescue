from __future__ import annotations

from html import escape

from app.core.config import get_settings
from app.core.geo import maps_link


def incident_url(ref: str) -> str:
    return f"{get_settings().site_url}/incidents/{ref}"


def sms_text(incident: dict) -> str:
    lat, lng = incident["lat"], incident["lng"]
    unverified = "" if incident["verification_source"] != "rules" else " (auto-triaged)"
    lines = [
        f"DAVORESCUE {incident['subtype'].upper()} sev{incident['severity']}/5{unverified}",
        incident["dispatch_message"],
        f"GPS {lat:.5f},{lng:.5f} {maps_link(lat, lng)}",
    ]
    if incident.get("navigability") in ("unnavigable", "off_network") and incident.get("access_lat"):
        lines.append(
            f"Vehicle access {int(incident['access_distance_m'])}m: "
            f"{maps_link(incident['access_lat'], incident['access_lng'])}"
        )
    if incident.get("reporter_contact"):
        lines.append(f"Reporter: {incident['reporter_contact']}")
    lines.append(f"Ref {incident['ref']}")
    return "\n".join(lines)


def email_subject(incident: dict) -> str:
    place = incident.get("road_name") or incident.get("lga") or incident["state"].title()
    return f"[{incident['ref']}] {incident['subtype'].title()} — {place} (severity {incident['severity']}/5)"


def email_bodies(incident: dict, agency_name: str) -> tuple[str, str]:
    lat, lng = incident["lat"], incident["lng"]
    rows = [
        ("Reference", incident["ref"]),
        ("Incident", f"{incident['category']} / {incident['subtype']}"),
        ("Severity", f"{incident['severity']} of 5 · panic score {incident['panic_score']}"),
        ("Verification", f"{incident['verdict']} ({incident['verification_source']}, "
                         f"confidence {incident['confidence']:.0%})"),
        ("Location", incident.get("location_summary") or ""),
        ("Coordinates", f"{lat:.6f}, {lng:.6f} (±{int(incident.get('accuracy_m') or 0)} m)"),
        ("Map", maps_link(lat, lng)),
        ("Address", incident.get("address") or "—"),
        ("Reporter callback", incident.get("reporter_contact") or "Anonymous"),
        ("Report", incident["description"]),
    ]
    text = f"For: {agency_name}\n\n{incident['dispatch_message']}\n\n" + "\n".join(
        f"{label}: {value}" for label, value in rows
    ) + f"\n\nLive incident page: {incident_url(incident['ref'])}\n"
    table = "".join(
        f"<tr><td style='padding:6px 12px 6px 0;color:#57534e;vertical-align:top'>{escape(label)}</td>"
        f"<td style='padding:6px 0'>{escape(str(value))}</td></tr>"
        for label, value in rows
    )
    html = (
        "<div style='font-family:Arial,sans-serif;font-size:14px;color:#1c1917'>"
        f"<p style='margin:0 0 4px;color:#57534e'>For: {escape(agency_name)}</p>"
        f"<h2 style='margin:0 0 12px;font-size:18px'>{escape(incident['dispatch_message'])}</h2>"
        f"<table style='border-collapse:collapse'>{table}</table>"
        f"<p><a href='{maps_link(lat, lng)}'>Open location in Google Maps</a> · "
        f"<a href='{incident_url(incident['ref'])}'>Live incident page</a></p>"
        "<p style='color:#78716c;font-size:12px'>Sent automatically by DavoRescue for Enugu & the South-East.</p>"
        "</div>"
    )
    return html, text
