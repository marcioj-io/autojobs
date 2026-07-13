import {
  FilterDecision,
  PreFilter,
  PreFilterContext
} from "../preFilter/preFilter.types";

export class NegativeKeywordFilter implements PreFilter {

  evaluate(ctx: PreFilterContext): FilterDecision {

    const text = [
      ctx.job.title,
      ctx.job.description,
      ctx.job.location
    ]
      .join(" ")
      .replace(/[\n\r\t]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();


    for (const keyword of ctx.profile.negativeKeywords) {

      const value = keyword
        .trim()
        .replace(/\s+/g, " ");

      if (!value) {
        continue;
      }


      const escaped = value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );


      const regex = new RegExp(
        `(^|\\W)${escaped}(\\W|$)`,
        "i"
      );


      if (regex.test(text)) {

        return {
          approved: false,
          reason: `Keyword negativa encontrada: ${value}`
        };

      }
    }

    return {
      approved: true
    };

  }

}