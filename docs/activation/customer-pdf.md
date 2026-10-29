# Customer information from one PDF

Chris adds customer information in exactly one way: by uploading a PDF in **Customer Onboarding → Customer Context**. The old typed-entry form (categories, names, text boxes, **Save information**, **Analyze customer**) is gone. The analysis starts by itself.

## What happens on upload

```
browser ──PDF──▶ session layer ──▶ POST handoff-documents (operator only)
                                     1. validate     size ≤ 8 MB, real %PDF- header, complete file (%%EOF)
                                     2. extract      pdf.js in a worker thread: 20 s limit, 192 MB heap cap, ≤ 60 pages,
                                                     ≤ 110,000 characters; one PDF at a time, 3 waiting at most
                                     3. structure    sections → up to 12 typed entries (the existing customer-information model)
                                     4. save         workspace revision + a report of what was read (the PDF itself is not kept)
                                     5. analyze      the existing analysis: Gemini or rule-based, same privacy screening,
                                                     evidence rules and fallbacks
```

Code: `services/workflow-api/src/activation/document/` contains `pdf.ts`, `pdf-worker.ts`, `structure.ts` and `upload.ts`. `handoff/service.ts` adds `saveDocument`.

## How the document is structured

- **Sections.** A heading starts a section. A line counts as a heading if it's:
  - noticeably larger than the body text;
  - numbered, like `2.` or `IV.`;
  - in capitals;
  - or a short line naming a known section, like "Discovery call" or "Internal notes:".

  Text before the first heading becomes "Opening". A first line larger than everything else is treated as the document's title, not a section.
- **Categories.** These are the seven existing ones, decided in this order:
  1. *Private first.* A heading naming CRM, deals or pricing gives **CRM Record**. A heading saying internal, private or confidential gives **My Notes**. A section whose sentences are commercial (money, ARR, discount, renewal, deal stage) is CRM whatever its heading says.
  2. Otherwise the heading decides: transcript or call gives Conversational Transcript; requirements, technical or security gives Technical Requirements; tools or integrations gives Integration Tools; background or overview gives Account Preparation.
  3. Without a telling heading, the content decides: timestamps or a repeated speaker give Conversational Transcript; mostly *must/should/required* gives Technical Requirements.
  4. Otherwise it's Account Preparation, shown to Chris as **category uncertain**.
- **Never "Repository Observation".** In the existing analysis that category means the Portal backend observed something itself, and it counts as *verified*. What a document says about repositories is someone's report, so it's read as Technical Requirements.
- **Clean-up.** Running headers and footers repeated on most pages, and bare page numbers, are removed and counted. Words split by a hyphen at a line break are joined.
- **Limits.** Long sections are split. Neighbouring sections of the same category are merged until there are at most 12 entries. Nothing is dropped silently: if text still had to be cut, the report says so.

## What Chris sees

- **File summary:** pages read out of the total, characters, sections, and the customer as the document states it (or from its title). It shows **Fully read** or **Partly read**.
- **Partly read** is shown whenever pages had no text (scanned images), pages couldn't be read, pages were beyond the 60-page limit, or text was cut. The banner names the pages, and the analysis panel and the Onboarding Draft both repeat that the draft comes from a partly read PDF.
- **Different customer:** if the document names another customer than the one selected, a warning appears.
- **Not found in the document:** customer, people and roles, systems, or goals. This is a heuristic check, shown as a prompt and not as a fact. The analysis lists those as unknowns rather than guessing.
- **How the document was read:** each section, its category and why (heading, content or uncertain), and how many header and footer lines were removed. The read text is behind a disclosure.

## Errors

| Code | When | Message to Chris (summary) |
|---|---|---|
| `NOT_A_PDF` / `PDF_REQUIRED` | Not a PDF (checked in the browser and on the server), or empty | Save or export it as a PDF |
| `PDF_TOO_LARGE` | Over 8 MB (browser and server) | Remove large images or split it |
| `PDF_ENCRYPTED` | Password-protected | Export an unprotected copy |
| `PDF_INVALID` / `PDF_UNREADABLE` | Damaged, cut off, or uses unsupported features | Export or print it to a new PDF |
| `PDF_NO_TEXT` (with page count) | No text at all: a scan or photos | Export with selectable text or run OCR first |
| `PDF_TIMEOUT` | Reading took over 20 s | Try a smaller or simpler PDF |
| `PDF_BUSY` | Other PDFs are being read | Try again in a minute |
| `ANALYSIS_RUNNING` | An analysis is still running | Wait for it to finish |
| `AWAITING_CHAMPION_REVIEW`, `ALREADY_APPROVED`, `ALREADY_PUBLISHED` | The plan is with Maya or published | Withdraw first / no longer changes |
| `ANALYSIS_LIMIT`, `RATE_LIMITED` | Hosted demo limits (an upload counts as an analysis) | Try later or start a new room |

A refused upload saves nothing. These checks run *before* the file is parsed, so time isn't spent on a file that would be refused anyway.

## Permissions and privacy

- **Who can upload.** Only the operator persona, for the customers listed for it. Developers, the Champion, other customers and cross-site requests are refused, at the session layer and in the API. In the hosted demo, the upload stays inside the visitor's demo room.
- **What is stored.** The PDF bytes aren't stored anywhere, only the extracted text, which is operator-only, as typed entries were before.
- **What reaches others.** Maya and developers see only what passes the existing privacy screen after Chris submits. Insights and AiKA use the approved plan, as before.
- **Safe parsing.** pdf.js reads text only:
  - nothing is rendered, and no fonts are loaded;
  - XFA forms are off, and nothing is fetched;
  - version 6 has no `eval` font path.

  A crash or runaway file ends its worker thread, not the server.

## Fictional sample

`prototypes/v1/public/samples/aperture-commerce-discovery-notes-fictional.pdf` is offered as **Download a fictional sample PDF** for the fictional demo customers. It is generated by `services/workflow-api/test/support/sample-pdf.mjs`, and a test keeps the two identical.

## Limitations

- **Scans:** image-only pages can't be read, because there's no OCR (that would need a paid service or a heavy local engine). They are reported page by page.
- **Complex layouts:** text is read in the order the PDF draws it. That's correct for most word-processor and Google Docs exports, including columns. Unusual layouts (text boxes placed out of order, tables) may read out of order.
- **Heuristics:** headings, categories, the customer name and "not found" topics are heuristics. Uncertain categories are labelled, and Chris reviews the draft before Maya sees anything.
- **One PDF per customer:** a new upload replaces the information and starts a new analysis.
