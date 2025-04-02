fetch("klasy.json")
.then(response => response.json())
.then(data => {
    //let numerKlasa = Math.floor(Math.random()*9);
    //let numerPytanie = Math.floor(Math.random()*4)
    let pytania = data.klasa[0].pytania[0];
    let odpowiedzi = data.klasa[0].pytania[1]
    document.querySelector(".pytanie").innerHTML = pytania;  
    let odpbox = document.getElementsByClassName("odp");
    if (Array.isArray(odpowiedzi)){
        for(let i = 0;i < odpbox.length;i++){
            odpbox[i].innerHTML = `${odpowiedzi[i][0]}`;
            if(odpowiedzi[i][1] == true){
                odpbox[i].innerHTML = "TRUE"
            }
        }
}   

})
.catch(error => console.error("Błąd:", error));