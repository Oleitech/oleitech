var showRegisterScreen = document.getElementById("show_register");

var login_container = document.querySelector(".login_container");

var register_container = document.querySelector(".register_container");

var login_btn = document.getElementById("login_btn");

var emailOneLogin = document.getElementById("emailOneLogin");

var passwordOneLogin = document.getElementById("passwordOneLogin");

var voltarAoLogin = document.getElementById("voltarAoLogin");



showRegisterScreen.onclick = function(){

    login_container.style.display = "none";

    register_container.style.display = "flex";

}



voltarAoLogin.onclick = function(){

  login_container.style.display = "flex";

  register_container.style.display = "none";

}



var getUsers ;

login_btn.addEventListener("click", async () => {

  const userAction = async () => {

      const response = await fetch('https://nodejsapi.rodrigodeveloper.pt/usersBVO', {

        method: 'GET',



      });

      const myJson = await response.json(); //extract JSON from the http response

      getUsers = myJson;



      // do something with myJson

  }

  await userAction();



    for (let i = 0; i < getUsers.length; i++) {

       if(getUsers[i].email == emailOneLogin.value && getUsers[i].password == passwordOneLogin.value){

        localStorage.setItem("session", "yes");

        localStorage.setItem("FirstName", `${getUsers[i].primeiro_nome}`);

        localStorage.setItem("LastName", `${getUsers[i].ultimo_nome}`);

        window.location.href= `backoffice/`  ;

      }else{

        Swal.fire({

          icon: "error",

          title: "Oops...",

          text: "Os dados que inseriu estão incorrectos!",

          confirmButtonColor: '#d0895d',

          iconColor: '#cb3741',

        });

      } 

    }



});



