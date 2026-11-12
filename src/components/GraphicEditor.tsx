"use client";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Upload,
  Undo2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  templates,
  templateRegistry,
  pageCount,
  type GraphicDocument,
  type GraphicSubject,
} from "@/lib/graphics";
const val = (v: unknown) => (v === null || v === undefined ? "" : String(v));
export function GraphicEditor({
  graphic,
  onChange,
  onTemplate,
  onRevert,
}: {
  graphic: GraphicDocument;
  onChange: (g: GraphicDocument) => void;
  onTemplate: (id: string) => void;
  onRevert: () => void;
}) {
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [origin, setOrigin] = useState("");
  const [rights, setRights] = useState("");
  const edit = (fn: (g: GraphicDocument) => void) => {
    const g = structuredClone(graphic);
    fn(g);
    onChange(g);
  };
  const template = templateRegistry[graphic.templateId];
  async function upload(file: File, index: number) {
    setAssetBusy(true);
    setAssetError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("origin", origin);
      body.set("rights", rights);
      body.set("attribution", graphic.source.attribution ?? "");
      const r = await fetch("/api/assets", {
        method: "POST",
        headers: { "x-tgiq-csrf": "1" },
        body,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      edit((g) => {
        g.subjects[index].image = d.asset.url;
      });
    } catch (e) {
      setAssetError(e instanceof Error ? e.message : "Upload unavailable");
    } finally {
      setAssetBusy(false);
    }
  }
  const subjectFields: Array<
    keyof Pick<
      GraphicSubject,
      "name" | "team" | "role" | "image" | "crest" | "season" | "competition"
    >
  > = ["name", "team", "role", "image", "crest", "season", "competition"];
  return (
    <div className="editor">
      <label>
        Template
        <select
          aria-label="Graphic template"
          value={graphic.templateId}
          onChange={(e) => onTemplate(e.target.value)}
        >
          {[...new Set(templates.map((t) => t.family))].map((f) => (
            <optgroup label={f} key={f}>
              {templates
                .filter((t) => t.family === f)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid2">
        <label>
          Title
          <input
            aria-label="Graphic title"
            value={graphic.title}
            onChange={(e) =>
              edit((g) => {
                g.title = e.target.value;
              })
            }
          />
        </label>
        <label>
          Heading
          <input
            value={graphic.kicker}
            onChange={(e) =>
              edit((g) => {
                g.kicker = e.target.value;
              })
            }
          />
        </label>
      </div>
      <label>
        Subtitle / scope
        <input
          aria-label="Graphic scope"
          value={graphic.subtitle}
          onChange={(e) =>
            edit((g) => {
              g.subtitle = e.target.value;
            })
          }
        />
      </label>
      <div className="grid2">
        <label>
          Background
          <select
            value={graphic.background}
            onChange={(e) =>
              edit((g) => {
                g.background = e.target.value as "navy" | "transparent";
              })
            }
          >
            <option value="navy">Solid navy</option>
            <option value="transparent">Transparent</option>
          </select>
        </label>
        <label>
          Sidebar position
          <select
            value={graphic.placement}
            onChange={(e) =>
              edit((g) => {
                g.placement = e.target.value as "left" | "right";
              })
            }
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>
      {pageCount(graphic) > 1 && (
        <div className="row">
          <button
            onClick={() =>
              edit((g) => {
                g.page = Math.max(0, g.page - 1);
              })
            }
            disabled={graphic.page === 0}
          >
            <ChevronLeft size={13} />
          </button>
          <small>
            Page {graphic.page + 1} of {pageCount(graphic)}
          </small>
          <button
            onClick={() =>
              edit((g) => {
                g.page = Math.min(pageCount(g) - 1, g.page + 1);
              })
            }
            disabled={graphic.page >= pageCount(graphic) - 1}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
      <details open>
        <summary>Fields</summary>
        <div className="grid2">
          {[
            ...new Set([
              ...(template?.fields ?? []),
              ...Object.keys(graphic.fields),
            ]),
          ].map((k) => (
            <label key={k}>
              {k}
              {k==='Status'&&graphic.templateId.startsWith('transfer-')?<select aria-label="Transfer status" value={val(graphic.fields[k])} onChange={e=>edit(g=>{g.fields[k]=e.target.value||null})}><option value="">Select status</option><option value="Confirmed">Confirmed</option><option value="Reported">Reported</option></select>:<input value={val(graphic.fields[k])} onChange={e=>edit(g=>{g.fields[k]=e.target.value||null})}/> }
            </label>
          ))}
        </div>
        {!template?.fields.length && !Object.keys(graphic.fields).length && (
          <small>Use subjects, metrics and rows below.</small>
        )}
      </details>
      <details open>
        <summary>Subjects & images</summary>
        {graphic.subjects.map((s, i) => (
          <div className="panel" key={i} style={{ marginBottom: 8 }}>
            <div className="section-heading">
              <small>Subject {i + 1}</small>
              <button
                className="mini-btn danger"
                title="Remove subject"
                onClick={() =>
                  edit((g) => {
                    g.subjects.splice(i, 1);
                  })
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="grid2">
              {subjectFields.map((k) => (
                <label key={k}>
                  {
                    {
                      name: "Name",
                      team: "Club / detail",
                      role: "Role",
                      image: "Portrait URL",
                      crest: "Crest URL",
                      season: "Season",
                      competition: "Competition",
                    }[k]
                  }
                  <input
                    value={val(s[k])}
                    onChange={(e) =>
                      edit((g) => {
                        g.subjects[i][k] = e.target.value;
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="grow">
                Upload portrait
                <input
                  aria-label={`Upload portrait ${i + 1}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={assetBusy || !origin || !rights}
                  onChange={(e) => {
                    if (e.target.files?.[0]) upload(e.target.files[0], i);
                  }}
                />
              </label>
              {s.image && (
                <button
                  onClick={() =>
                    edit((g) => {
                      g.subjects[i].image = undefined;
                    })
                  }
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={() =>
            edit((g) => {
              g.subjects.push({
                id: `editorial:${crypto.randomUUID()}`,
                name: "",
              });
            })
          }
          disabled={graphic.subjects.length >= 4}
        >
          <Plus size={13} />
          Add subject
        </button>
        <div className="grid2" style={{ marginTop: 8 }}>
          <label>
            Image origin
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </label>
          <label>
            Image usage / licence
            <input value={rights} onChange={(e) => setRights(e.target.value)} />
          </label>
        </div>
        {assetBusy && (
          <small>
            <Upload size={12} /> Uploading
          </small>
        )}
        {assetError && <p className="notice error">{assetError}</p>}
      </details>
      <details open>
        <summary>Metrics ({graphic.metrics.length})</summary>
        {graphic.metrics.map((m, i) => (
          <div className="panel" key={i} style={{ marginBottom: 6 }}>
            <div className="field-row">
              <label>
                Metric
                <input
                  value={m.label}
                  onChange={(e) =>
                    edit((g) => {
                      g.metrics[i].label = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Value
                <input
                  aria-label={`Metric value ${i + 1}`}
                  value={val(m.value)}
                  onChange={(e) =>
                    edit((g) => {
                      g.metrics[i].value = e.target.value || null;
                    })
                  }
                />
              </label>
              <button
                className="danger"
                title="Remove metric"
                onClick={() =>
                  edit((g) => {
                    g.metrics.splice(i, 1);
                  })
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="grid2">
              {graphic.templateId.startsWith("comparison-") ||
              graphic.templateId === "statistics-match" ? (
                <label>
                  Other value
                  <input
                    value={val(m.other)}
                    onChange={(e) =>
                      edit((g) => {
                        g.metrics[i].other = e.target.value || null;
                      })
                    }
                  />
                </label>
              ) : null}
              <label>
                Unit
                <input
                  value={m.unit ?? ""}
                  onChange={(e) =>
                    edit((g) => {
                      g.metrics[i].unit = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Metric source
                <input
                  value={m.source ?? ""}
                  onChange={(e) =>
                    edit((g) => {
                      g.metrics[i].source = e.target.value;
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
        <button
          onClick={() =>
            edit((g) => {
              g.metrics.push({ label: "", value: null });
            })
          }
        >
          <Plus size={13} />
          Add metric
        </button>
      </details>
      <details>
        <summary>Rows / milestones / arguments ({graphic.rows.length})</summary>
        {graphic.rows.map((r, i) => (
          <div className="panel" key={i} style={{ marginBottom: 8 }}>
            <div className="field-row">
              <label>
                Label
                <input
                  value={r.label}
                  onChange={(e) =>
                    edit((g) => {
                      g.rows[i].label = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Value / date
                <input
                  value={r.date ?? val(r.value)}
                  onChange={(e) =>
                    edit((g) => {
                      if (g.templateId.startsWith("timeline"))
                        g.rows[i].date = e.target.value;
                      else g.rows[i].value = e.target.value || null;
                    })
                  }
                />
              </label>
              <button
                className="danger"
                title="Remove row"
                onClick={() =>
                  edit((g) => {
                    g.rows.splice(i, 1);
                  })
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="grid2">
              <label>
                Other value
                <input
                  value={val(r.other)}
                  onChange={(e) =>
                    edit((g) => {
                      g.rows[i].other = e.target.value || null;
                    })
                  }
                />
              </label>
              <label>
                Rank
                <input
                  type="number"
                  min="1"
                  value={r.rank ?? ""}
                  onChange={(e) =>
                    edit((g) => {
                      g.rows[i].rank = e.target.value
                        ? Number(e.target.value)
                        : null;
                    })
                  }
                />
              </label>
              <label>
                Caption / note
                <input
                  value={r.note ?? ""}
                  onChange={(e) =>
                    edit((g) => {
                      g.rows[i].note = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Image URL
                <input
                  value={r.image ?? ""}
                  onChange={(e) =>
                    edit((g) => {
                      g.rows[i].image = e.target.value;
                    })
                  }
                />
              </label>
              {r.columns && (
                <label>
                  Table columns (comma separated)
                  <input
                    value={r.columns.map(val).join(",")}
                    onChange={(e) =>
                      edit((g) => {
                        g.rows[i].columns = e.target.value
                          .split(",")
                          .map((v) => v.trim() || null);
                      })
                    }
                  />
                </label>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={() =>
            edit((g) => {
              g.rows.push({ label: "", value: null });
            })
          }
        >
          <Plus size={13} />
          Add row
        </button>
      </details>
      {graphic.match && (
        <details>
          <summary>Score & goals</summary>
          <div className="grid2">
            {(["home", "away"] as const).map((side) => (
              <div key={side}>
                <label>
                  {side === "home" ? "Home" : "Away"} team
                  <input
                    value={graphic.match![side].name}
                    onChange={(e) =>
                      edit((g) => {
                        g.match![side].name = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Score
                  <input
                    type="number"
                    min="0"
                    value={graphic.match![`${side}Score`] ?? ""}
                    onChange={(e) =>
                      edit((g) => {
                        g.match![`${side}Score`] = e.target.value
                          ? Number(e.target.value)
                          : null;
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <label>
            Status
            <input
              value={graphic.match.status}
              onChange={(e) =>
                edit((g) => {
                  g.match!.status = e.target.value;
                })
              }
            />
          </label>
          <div className="grid2">
            {(["aggregate", "shootout"] as const).map((kind) => (
              <div key={kind}>
                <label>
                  {kind}
                  <input
                    placeholder="Home, away"
                    value={
                      graphic.match![kind]
                        ? `${graphic.match![kind]!.home},${graphic.match![kind]!.away}`
                        : ""
                    }
                    onChange={(e) =>
                      edit((g) => {
                        const nums = e.target.value.split(",").map(Number);
                        g.match![kind] =
                          nums.length === 2 &&
                          nums.every((n) => Number.isFinite(n) && n >= 0)
                            ? { home: nums[0], away: nums[1] }
                            : undefined;
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          {graphic.match.events.map((event, i) => (
            <div className="panel" key={i} style={{ marginTop: 6 }}>
              <div className="grid2">
                <label>
                  Scorer
                  <input
                    value={event.name}
                    onChange={(e) =>
                      edit((g) => {
                        g.match!.events[i].name = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Minute
                  <input
                    value={event.minute}
                    onChange={(e) =>
                      edit((g) => {
                        g.match!.events[i].minute = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Team
                  <select
                    value={event.team}
                    onChange={(e) =>
                      edit((g) => {
                        g.match!.events[i].team = e.target.value as
                          "home" | "away";
                      })
                    }
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                  </select>
                </label>
                <label>
                  Goal type
                  <select
                    value={
                      event.ownGoal ? "og" : event.penalty ? "pen" : "normal"
                    }
                    onChange={(e) =>
                      edit((g) => {
                        g.match!.events[i].ownGoal = e.target.value === "og";
                        g.match!.events[i].penalty = e.target.value === "pen";
                      })
                    }
                  >
                    <option value="normal">Goal</option>
                    <option value="pen">Penalty</option>
                    <option value="og">Own goal</option>
                  </select>
                </label>
              </div>
              <button
                className="mini-btn danger"
                title="Remove goal"
                onClick={() =>
                  edit((g) => {
                    g.match!.events.splice(i, 1);
                  })
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              edit((g) => {
                g.match!.events.push({ team: "home", name: "", minute: "" });
              })
            }
          >
            <Plus size={13} />
            Add goal
          </button>
        </details>
      )}
      <details>
        <summary>Source & attribution</summary>
        <div className="grid2">
          {(
            [
              "provider",
              "url",
              "attribution",
              "reportingPeriod",
              "season",
              "competition",
            ] as const
          ).map((k) => (
            <label key={k}>
              {
                {
                  provider: "Provider",
                  url: "Source URL",
                  attribution: "Attribution",
                  reportingPeriod: "Reporting period / date",
                  season: "Season",
                  competition: "Competition",
                }[k]
              }
              <input
                value={graphic.source[k] ?? ""}
                onChange={(e) =>
                  edit((g) => {
                    g.source[k] = e.target.value;
                  })
                }
              />
            </label>
          ))}
        </div>
        <p className="source-note" style={{ marginTop: 8 }}>
          Editorial changes are stored separately from source values. Reported
          transfers and sourced financial figures need explicit status, date and
          attribution.
        </p>
        <button onClick={onRevert}>
          <Undo2 size={13} />
          Revert to source
        </button>
      </details>
    </div>
  );
}
