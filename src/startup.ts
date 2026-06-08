import { initIESTenser } from "./model/model_parser";

// startup aync callings.
export async function applicationInit(): Promise<any> {
    await initIESTenser();
    return;
}