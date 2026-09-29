//const get = () => {
//    const txt = ``
//   const hases: string[] = [];

//    const up = txt.replace(/#[^\s]*/gm, x => { hases.push(x); return "$$"; });
//    console.log(up)
//    console.log(hases)

//    let i = 0;
//    const outTxt = up.replace(/\$\$/gm, () => hases[i++]);
//    console.log(outTxt)

//}

//get()





async function getData() {
    //const idX = "2085919981259415643"
    // 'Cookie': "PHPSESSID=39647095_ak7QFeFI6KC4dNZaYVQKu52qmvLKPvQi"
    const url = `https://fxtwitter.com/simonrojas937/status/2098197100613796098`;

    try {
        const response = await fetch(url, {
            headers: {
                'Referer': 'https://www.pixiv.net/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

            }
        });

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} - ${response.statusText}`);
        }

        //const pagesData = await response.json()

        //const data = await response.text();
        console.log(response)
        //console.dir(JSON.parse(data), { depth: null });

    } catch (e) {
        console.error("Error detallado en el fetch:", e);
    }
}

getData();
