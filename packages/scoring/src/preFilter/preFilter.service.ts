import {
    FilterDecision,
    PreFilter,
    PreFilterContext
} from "./preFilter.types";

import { SeniorityFilter } from "../filters/seniority.filter";
import { TitleFilter } from "../filters/title.filter";
import { NegativeKeywordFilter } from "../filters/negativeKeyword.filter";
import { DescriptionFilter } from "../filters/description.filter";


export class PreFilterService {

    private readonly filters: PreFilter[];


    constructor() {

        this.filters = [

            new TitleFilter(),

            new SeniorityFilter(),

            new NegativeKeywordFilter(),

            new DescriptionFilter()

        ];

    }


    evaluate(
        ctx: PreFilterContext
    ): FilterDecision {


        for (const filter of this.filters) {


            const result =
                filter.evaluate(ctx);


            if (!result.approved) {

                return result;

            }

        }


        return {

            approved: true

        };

    }

}