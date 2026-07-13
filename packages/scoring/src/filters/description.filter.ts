import {
  FilterDecision,
  PreFilter,
  PreFilterContext
} from "../preFilter/preFilter.types";

export class DescriptionFilter implements PreFilter {

  private static readonly MIN_DESCRIPTION_LENGTH = 50;

  evaluate(ctx: PreFilterContext): FilterDecision {

    const description = (ctx.job.description ?? "")
      .replace(/[\n\r\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (description.length < DescriptionFilter.MIN_DESCRIPTION_LENGTH) {
      return {
        approved: false,
        reason: `Descrição insuficiente (${description.length} caracteres).`
      };
    }

    return {
      approved: true
    };
  }

}