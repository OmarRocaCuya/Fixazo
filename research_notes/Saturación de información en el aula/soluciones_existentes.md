# Soluciones existentes: herramientas que enseñan a pensar con información (global, LatAm, Perú, a 2026)

Research scope: Socratic AI tutors, media literacy/prebunking, critical thinking/argumentation platforms, hackathon projects, and gaps for Spanish-speaking public school students with low connectivity. 15 tool calls were used. Several items are marked as gaps where no primary source was found.

## 1. Socratic / "no-answer" AI tutors (Khanmigo, Gemini Guided Learning, ChatGPT Study Mode, Claude Learning mode): adoption and evidence

### Takeaway
All the big LLM vendors now ship a "guided / no direct answer" mode, so a generic Socratic chatbot is already a commodity. The best causal evidence (a 2-year Khanmigo RCT, NBER Aug 2026) shows small gains, about the same as plain Khan Academy practice, and identifies **student engagement, not access, as the binding constraint**: students rarely ask the tutor for help and mostly type bare answers.

### Cited Findings
- **Khanmigo RCT (NBER w35620, Oreopoulos & Low, Aug 2026):** two-year cluster RCT in 18 Tennessee middle schools. The tutor was configured to coach rather than give answers. Assignment raised math scores by 1.3 national percentile ranks per term (about 0.06–0.08 SD per year). The implied effect of a full year of active use is 0.14 SD. Gains were **similar to Khan Academy practice without AI**. — [NBER](https://www.nber.org/papers/w35620)
- Same study, engagement: 96% of students tried Khanmigo, but the median student messaged it on only about 1/3 of practice days and in only 17% of sessions where they made a mistake. Most messages were bare answers or clicks on suggested prompts, not substantive dialogue. The authors write that "the binding constraint appears to be engagement". — [NBER](https://www.nber.org/papers/w35620)
- Khan Academy says the tested 2023 version has since been rebuilt to surface help inside practice after a wrong answer. — [FutureEd](https://www.future-ed.org/students-tried-khanmigos-ai-tutor-most-didnt-want-its-help/)
- Khanmigo reach: 2.0M students, educators and parents used it in SY24-25 (vendor usage figure, not an outcome). — [Khan Academy annual report](https://www.annualreport.khanacademy.org/)
- Undergraduate physics study with Khanmigo (2025, n=69): learning gains in all conditions, but no significant difference between AI and non-AI groups. Students saw it as a supplement. — [EKU Encompass](https://encompass.eku.edu/fs_research/782)
- **ChatGPT Study Mode** ("Study and Learn") launched July 29, 2025 for all users. It gives some information, checks comprehension before revealing more, and can be toggled off mid-session. — [glasp.ai comparison](https://glasp.ai/articles/ai-study-modes-compared); [Pearson](https://pearson.com/international-schools/international-schools-blog/2026/02/what-is-gemini_s-guided-learning-and-chatgpts-study-mode-.html); [The Windows Club](https://www.thewindowsclub.com/chatgpt-study-mode-vs-geminis-guided-learning-for-students)
- **Gemini Guided Learning** (August 2025) breaks a topic into steps, asks guiding questions and asks students to explain their thinking. — [Pearson](https://pearson.com/international-schools/international-schools-blog/2026/02/what-is-gemini_s-guided-learning-and-chatgpts-study-mode-.html)
- **Claude for Education / Learning mode** was announced in April 2025, mainly through institutional (university) deals. Claude also offers "Explanatory" and "Learning" output styles. One reviewer judges Claude's mode to hold the Socratic line most firmly (opinion, not measured data). — [glasp.ai](https://glasp.ai/articles/ai-study-modes-compared); [Wonder Tools](https://wondertools.substack.com/p/turn-ai-into-your-personal-tutor)
- In all three products the normal answer-giving chat is one toggle away. — [glasp.ai](https://glasp.ai/articles/ai-study-modes-compared)
- **Peru:** a World Bank program (since 2025, "Eligiendo Mi Camino") reached about 4,500 5th-year secondary students in 85 Lima public schools with an AI math tutor and an AI career counselor ("Gallito"). Partners are uDocz, Anthropic and Microsoft. The page reports no learning outcomes yet. An RCT in Peru is studying how to design AI tutors that build lasting skills. A separate RCT in 390 Lima schools found that teachers learned to write clearer prompts and **evaluate AI outputs more critically**. — [World Bank](https://www.bancomundial.org/es/results/2026/07/02/artificial-intelligence-in-action-in-latin-america-s-schools-evidence-from-peru)

### Inferences
- Building "another Socratic tutor" competes with free features from OpenAI, Google and Anthropic, and with funded actors in Lima (World Bank, uDocz, Anthropic). The white space is in **making students actually engage** (motivation, low-friction prompts, teacher-orchestrated use), not in the "no-answer" behavior itself.
- Because the answer-giving mode is one toggle away, a tool whose "think-first" behavior is enforced (for example by the teacher, by task design, or by grading the reasoning) differs from consumer modes.

### Gaps
- No independent controlled study of ChatGPT Study Mode, Gemini Guided Learning or Claude Learning mode was found, and no vendor outcome data.
- Adoption numbers for these modes in Peru/LatAm schools were not found.
- A podcast claim that Study Mode was later removed conflicts with 2026 guides that say it is free on all plans. Not resolved. — [Podbean](https://www.podbean.com/media/share/pb-vevns-1974a8b?download=1)
- A "12% math gain" claim attributed to a 2026 Khanmigo RCT appears in secondary summaries without a primary source. Unverified. — [plainai summary](https://plainai.aguidetocloud.com/changes/khanmigo-classroom-results/)

## 2. Media literacy / prebunking (Checkology, Bad News/Go Viral!, Finland; LatAm and Peru)

### Takeaway
Prebunking games have large-sample evidence for lowering belief in fake headlines (about 20% lower perceived reliability). However, there is a live methodological dispute over whether they improve *discernment* or only make players more skeptical of everything. Checkology shows gains but high attrition. In LatAm, fact-checkers' school work is small, fragmented and mostly unevaluated. In Peru, there is no structured, scaled school program from Ojo Público, La República or Salud con Lupa.

### Cited Findings
- **Bad News (Roozenbeek & van der Linden, Palgrave Communications 2019):** about 15,000 participants. Perceived reliability of fake headlines fell by about 21% after about 15 minutes of play, with no change for real news. The most susceptible players benefited most. The authors call it a "moderate" effect. — [Neuroscience News](https://neurosciencenews.com/prebunking-disinformation-14314/); [Cambridge repository](https://doi.org/10.17863/CAM.48846)
- Bad News effects lasted for more than two months in one large study. — [Behavioral Scientist](https://behavioralscientist.org/a-new-way-to-inoculate-people-against-misinformation/)
- "Good News about Bad News" (2020): gamified inoculation also boosts confidence in spotting fake news. — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6952868/)
- **Go Viral!** is a 5-minute COVID-19 game built with the UK Cabinet Office, with UN and WHO support. — [Behavioral Scientist](https://behavioralscientist.org/a-new-way-to-inoculate-people-against-misinformation/)
- **Critique:** Modirrousta-Galian & Higham (2023, JEP: General 152(9)) reanalyzed 5 studies with ROC analysis. Bad News and Go Viral! **did not improve true/fake discrimination**. They shifted all answers toward "false" (response bias). — [Southampton ePrints](https://eprints.soton.ac.uk/475360); a 2026 Psychonomic Bulletin & Review replication in India also found only a conservative bias shift. — [UCL Discovery](https://discovery.ucl.ac.uk/id/eprint/10211973/7/Modirrousta-Galian_s13423-025-02827-x.pdf)
- **Contradicting:** a signal-detection meta-analysis of 33 inoculation experiments found that gamified and video interventions do improve discernment without increasing response bias. — [Bristol research portal](https://research-information.bris.ac.uk/en/publications/a-signal-detection-theory-meta-analysis-of-psychological-inoculat/); [BGU CRIS](https://cris.bgu.ac.il/en/publications/a-signal-detection-theory-meta-analysis-of-psychological-inoculat-2/)
- Other work: feedback exercises after gameplay significantly boost discernment, mainly by improving accuracy on real news. Effects decay without memory-strengthening practice. — [Scientific Reports 2023](https://link.springer.com/10.1038/s41598-023-43885-2)
- Cat Park replication (N=380): players rated misinformation as less reliable but did not become more confident. — [Uni Bamberg](https://fis.uni-bamberg.de/bitstreams/8c207b55-f027-4509-a417-ee0ad79ea76b/download)
- **Checkology (News Literacy Project, US):** about 300,000 students have used it since 2016. — [newslit.org](https://newslit.org/about/mission/). In 2024-25, students who completed lessons improved on 14 metrics (12 significant). But 46.3% of pre-survey takers answered no post questions, and some standards stayed below 50% correct (for example 32.8% and 44.1% on "news vs other information"). — [Checkology 24-25 summary](https://newslit.org/wp-content/uploads/2025/09/Checkology-24-25-ExecutiveSummary.pdf). The 2022-23 results were mixed, with some metrics declining. — [22-23 summary](https://get.checkology.org/wp-content/uploads/2023/11/Final22-23ExecutiveSummary.pdf). These are NLP's own evaluations through an outside consultant, not peer-reviewed.
- **Finland:** first in the Media Literacy Index every year since 2017, including 2023. — [Finland Toolbox](https://toolbox.finland.fi/?p=57229). Media literacy has been in the national curriculum from age 3, and teachers are now adding AI literacy. — [CTV/AP](https://www.ctvnews.ca/lifestyle/article/finlands-battle-against-fake-news-starts-in-preschool-classrooms/). Helsingin Sanomat's 2024 "ABC Book of Media Literacy" goes to every 15-year-old. — [Yahoo/AP](https://www.yahoo.com/news/articles/finlands-battle-against-fake-news-052353818.html). Note: the index measures education, press freedom, trust and e-participation, not a specific school product.
- **Chequeado Educación (Argentina):** in 2024 it worked with Santillana to insert a "Desinformados" critical-thinking section into first-year Social and Natural Sciences textbooks. — [Chequeado](https://chequeado.com/acercar-la-alfabetizacion-mediatica-a-las-aulas-a-traves-de-libros-escolares/). More than 7,800 people have taken its online courses since 2015, and it runs the "el Chequeador" platform. — [Chequeado cursos](https://chequeado.com/cursos/)
- **Chequeado + UNESCO regional study (2025):** it mapped media and information literacy (AMI) initiatives from 14 organizations in 11 LatAm countries, mostly LatamChequea members. The main challenges named are **sustainability, more professional education teams, and impact-measurement tools**. — [Chequeado PDF](https://chequeado.com/wp-content/uploads/2025/11/Guia-Estudio-regional-sobre-AMI-FINAL-1.pdf). The same source cites Kids Online Argentina 2025: only 60% of 9–17-year-olds can tell whether a website is reliable. — [Chequeado](https://chequeado.com/acercar-la-alfabetizacion-mediatica-a-las-aulas-a-traves-de-libros-escolares/)
- **Peru, "Verifica pe":** journalist Lucero Ascarza, formerly of Salud con Lupa, runs media literacy workshops for secondary students. 27 trainers have been trained and more than 3,200 people reached (ICFJ figures, not independently confirmed). — [ICFJ](https://www.icfj.org/news/how-peruvian-journalist-turned-media-literacy-community-movement); [IJNet](https://ijnet.org/en/story/how-peruvian-journalist-turned-media-literacy-community-movement)
- **Peru, Ojo Biónico (Ojo Público):** a fact-checking section, extended to radio through a weekly segment with RPP. It is aimed at the general public, not schools. — [LatAm Journalism Review](https://latamjournalismreview.org/articles/peruvian-media-bring-fact-checking-to-radios-across-the-country-with-new-segment-to-verify-public-discourse/)
- **Peru, other AI/digital programs:** UNDP + Minedu "Digi-Wise" pilot in 3 regions for students aged 12–14. Its target is 6,000 students and 200 teachers in digital and AI skills. — [UNDP](https://www.undp.org/es/node/564471). MentorIA Perú (Kodea, Empresarios por la Educación, Google.org, with Minedu support) trains teachers in AI tools, with 1,500 more planned in Lima, Lambayeque and Arequipa. — [RPP](https://rpp.pe/campanas/publirreportaje/kodea-y-empresarios-por-la-educacion-impulsan-la-educacion-digital-con-inteligencia-artificial-noticia-1622984)

### Inferences
- The prebunking literature points to a design opportunity. Use **discernment-focused tasks** (true *and* false items, with feedback) and **spaced repetition** ("boosters"), not only a one-shot game that makes students cynical.
- In Peru, school media literacy is run by individuals and small NGOs (Verifica pe) or is teacher-facing (MentorIA, Digi-Wise). No product in Spanish, adapted to the Peruvian curriculum and student-facing, was found that measures discernment over time. That is a plausible white space.
- Chequeado and UNESCO name **impact measurement** as a regional gap. A lightweight pre/post discernment measurement that fact-checking NGOs could reuse would fill a stated need.

### Gaps
- No evidence was found of a school program by **Verificador La República** or a formal Salud con Lupa school program (beyond Ascarza's spin-off).
- No current (2025–2026) **ProFuturo Peru** program focused on critical thinking or media literacy was found. Only a 2018 ProFuturo report on AI and inclusion surfaced. — [ProFuturo Retos 4](https://educacion.udd.cl/aprendizaje180/files/2020/12/ProFuturo-Retos-4.-Inteligencia-Artificial-e-Inclusión-Educativa.pdf)
- No Spanish-language adaptation of Bad News or Go Viral! deployed in Peruvian schools was confirmed (not searched in depth).
- How much media and information literacy appears in Minedu's curriculum was not verified.

## 3. Critical thinking / argumentation platforms (Kialo Edu, Letrus, debate, PBL in LatAm)

### Takeaway
Kialo Edu is free and widely used but has only self-reported evidence. Letrus (Brazil) is the strongest LatAm case: AI writing feedback evaluated in an RCT in public schools, which narrowed the public–private gap. No comparable Spanish-language, AI-feedback argumentation tool for Peruvian public schools was found.

### Cited Findings
- **Kialo Edu:** a free classroom version of Kialo built on argument trees (pro/con). The vendor says it increases participation and produces a gradable record of discussion. — [civictech directory](https://directory.civictech.guide/listing/kialo-edu-is-a-free-easy-to-use-platform-that-facilitates-thoughtful-and-inclusive-class-discussions-it-allows-students-to-contribute-simultaneously-build-on-each-others-arguments-and-develop-critical-thinking-skills-the-platform-is-designed-to-increase-s)
- Kialo is being tested in the Co³Learn project at Göttingen, Hannover and Braunschweig. No results were found. — [Uni Göttingen](https://www.uni-goettingen.de/en/677939.html)
- Mahoney (2022, JFLER): 118 university EFL students. Self-reports said Kialo helped debate and critical thinking, and participation and satisfaction increased. Not a causal study. — [JFLER PDF](https://fler.rikkyo.ac.jp/journal/jc0e3e00000000a9-att/JFLER(2022_Vol.3)_13_Mahoney.pdf)
- Kialo Edu has a Common Sense privacy rating and a California Student Data Privacy Agreement. — [School Data Leadership](https://www.schooldataleadership.org/systems/instruction-curriculum/kialo-edu)
- **Letrus (Brazil):** an RCT in Espírito Santo (from 2019) with J-PAL-affiliated researchers. It covered 178 public schools and about 12,000 students; 110 schools got the platform, in either AI-only feedback or AI + human feedback. Results reported through the IDB: significantly better performance and a **9% reduction in the public–private essay score gap**. — [J-PAL](https://www.povertyactionlab.org/es/node/8135946); [IDB blog](https://blogs.iadb.org/educacion/es/como-esta-transformando-la-inteligencia-artificial-la-ensenanza-de-la-lecto-escritura-en-brasil)
- Letrus in SESI since 2022 has helped correct more than 297,000 essays (adoption figure, no impact measure). — [Portal da Indústria](https://noticias.portaldaindustria.com.br/noticias/educacao/inteligencia-artificial-auxilia-correcao-de-mais-de-297-mil-redacoes-na-rede-sesi/)

### Inferences
- Letrus shows a proven pattern for LatAm public schools: **AI feedback on student production (writing or arguments) plus a teacher in the loop**, tied to a high-stakes exam (ENEM). Peru has no equivalent high-stakes essay exam, so the "hook" would need to be different (for example the curriculum competencies, or school debate/fair projects).
- Kialo's tree structure is useful but needs connectivity and does not give AI feedback on the *quality* of reasoning or sources.

### Gaps
- Debate programs in Peru (school debate leagues) and their reach were not researched.
- **PBL platforms in LatAm public schools** were not covered (no search performed within the budget). This is open.
- No Spanish-language Letrus-like product for Peru or the Andean region was confirmed.

## 4. AI-in-education hackathon winners 2024–2026 focused on critical thinking / "AI that makes you think"

### Takeaway
"Socratic AI tutor" is a very common hackathon project (Devfolio, university projects), but no prominent award-winning project with a distinctive approach was found. A team that pitches "Socratic chatbot" risks looking like a clone.

### Cited Findings
- "Socratic AI Tutor" on Devfolio: a GenAI tutor that asks probing questions instead of answering. No award is listed. — [Devfolio](https://devfolio.co/projects/socratic-ai-tutor-5e56)
- Georgia Tech's **Socratic Mind**, a piloted tool that asks students to explain and defend their reasoning. — [Times Higher Education](https://www.timeshighereducation.com/campus/when-ai-asks-why-and-facilitates-critical-thinking)
- CityU Hong Kong "Socratic AI" platform. — [CityU](https://socratic.cs.cityu.edu.hk); ASEE paper on Socratic AI agents for critical thinking. — [ASEE PEER](https://peer.asee.org/socratic-ai-agents-for-critical-thinking)
- Politecnico di Milano "Critically yours", a design project on AI and critical thinking. — [PoliMi](https://www.design.polimi.it/en/school/news/news-detail/critically-yours)
- GDSC Hacks 2025 and IEEE DevHack 2025 winners were not education or critical-thinking focused. — [U of Guelph](https://www.uoguelph.ca/ccmps/news/2025/05/gdsc-hacks-2025-ai-hackathon); [IEEE Computer Society](https://www.computer.org/publications/tech-news/insider-membership-news/ieee-ocai-2025-hackathon)

### Inferences
- Many projects and university pilots already exist. Differentiation must come from **context** (Peruvian public school, Spanish/Quechua, WhatsApp, offline), **evidence design** (measuring discernment or engagement), or **teacher orchestration**, not from the Socratic idea itself.

### Gaps
- No Devpost search results for specific 2024–2026 winners on this theme. Devpost was not searched directly.
- Past Hack the Andes Educación winners were not researched.

## 5. Gaps for Spanish-speaking public school students with low connectivity (WhatsApp-first, offline; teacher- vs student-facing)

### Takeaway
No rigorously evaluated, WhatsApp-first or offline tool for critical thinking or media literacy aimed at LatAm school students was found. Peru's current AI initiatives are mostly teacher-facing or math-focused. The intersection "student-facing + information discernment + WhatsApp/low-bandwidth + Spanish + measured" appears empty.

### Cited Findings
- No RCT of a WhatsApp chatbot tutor in low-connectivity LatAm was found. Existing items are proposals or vendor cases, for example the MIT Solve "WhatsApp Edu" proposal for rural LAC learners, which has no outcome data. — [MIT Solve](https://solve.mit.edu/solutions/52643)
- A 2022 Lima study of a WhatsApp chatbot supporting remote schooling under connectivity limits. Only the abstract was seen and learning outcomes are unknown. — [Ciencia Latina](https://ciencialatina.org/index.php/cienciala/article/download/1831/2618)
- "Are LLMs useful in the poorest schools?" (TheTeacher.AI, Sierra Leone): an LLM deployed through low-bandwidth channels for **teachers**. — [arXiv](https://arxiv.org/html/2310.02982v2)
- Peru's AI programs: World Bank tutor (math and career, students in Lima). — [World Bank](https://www.bancomundial.org/es/results/2026/07/02/artificial-intelligence-in-action-in-latin-america-s-schools-evidence-from-peru). MentorIA (teachers). — [RPP](https://rpp.pe/campanas/publirreportaje/kodea-y-empresarios-por-la-educacion-impulsan-la-educacion-digital-con-inteligencia-artificial-noticia-1622984). Digi-Wise (digital and AI skills, students aged 12–14, 3 regions). — [UNDP](https://www.undp.org/es/node/564471)
- Engagement, not access, limits AI tutors. — [NBER](https://www.nber.org/papers/w35620)
- LatAm media and information literacy organizations lack impact-measurement tools and sustainable education teams. — [Chequeado/UNESCO](https://chequeado.com/wp-content/uploads/2025/11/Guia-Estudio-regional-sobre-AMI-FINAL-1.pdf)

### Inferences (candidate white space for Hack the Andes)
- **Discernment practice over WhatsApp:** short daily "is this real?" items from Peruvian contexts (health, local politics, AI-generated images), with feedback and spaced boosters. This addresses the prebunking critique and the decay finding, and runs on low bandwidth.
- **Teacher-orchestrated "think before AI" routines:** the teacher assigns a task, the student must commit to a hypothesis and sources before the AI responds, and the teacher sees reasoning traces. This addresses the engagement constraint and the "toggle away" weakness of consumer study modes.
- **Reusable impact measurement for NGOs:** a lightweight pre/post discernment instrument that LatamChequea members (Chequeado, Ojo Público, Verifica pe) could plug into workshops.
- **Avoid:** a generic Socratic chatbot (commodity), a math AI tutor in Lima (World Bank/uDocz/Anthropic already there), or teacher AI-skills training (MentorIA, Digi-Wise).

### Gaps
- Smartphone and WhatsApp penetration among Peruvian secondary students and school connectivity statistics were not gathered in this pass.
- Quechua/Aymara-language tools were not researched.
- No data on Minedu policy regarding WhatsApp use with students (privacy, minors) was found.
- Offline-first education tools (for example Kolibri) in Peru were not researched.
